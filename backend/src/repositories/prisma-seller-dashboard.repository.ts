import {
  OrderStatus as PrismaOrderStatus,
  PaymentStatus as PrismaPaymentStatus,
  Prisma,
  type PrismaClient,
} from "../prisma/generated/client.js";
import { SellerOrderStateChangedError } from "./seller-dashboard.errors.js";
import type { OrderStatus } from "./order.repository.js";
import { restoreOrderInventory } from "./order-inventory.js";
import type {
  ProductEntity,
} from "./product.repository.js";
import type {
  SellerAnalytics,
  SellerAnalyticsPeriod,
  SellerDashboardPeriod,
  SellerDashboardRepository,
  SellerDashboardSummary,
  SellerOrderEntity,
  SellerOrderQuery,
  SellerOrdersResult,
  SellerProductQuery,
  SellerProductsResult,
} from "./seller-dashboard.repository.js";

const orderStatuses: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

const productRelations = {
  seller: {
    select: {
      id: true,
      name: true,
    },
  },
  category: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productRelations;
}>;

type SellerOrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    customer: {
      select: {
        id: true;
        name: true;
        email: true;
      };
    };
    payment: true;
    items: {
      include: {
        product: {
          select: {
            id: true;
            name: true;
            imageUrl: true;
            category: {
              select: {
                id: true;
                name: true;
              };
            };
          };
        };
      };
    };
  };
}>;

interface RevenueRow {
  totalRevenue: string;
  monthlyRevenue: string;
}

interface BestSellingRow {
  productId: string;
  name: string;
  unitsSold: string;
  revenue: string;
}

interface MonthlySalesRow {
  month: string;
  orders: string;
  unitsSold: string;
  revenue: string;
}

interface TopCategoryRow {
  categoryId: string;
  name: string;
  unitsSold: string;
  revenue: string;
}

interface InventorySummaryRow {
  totalProducts: string;
  lowStock: string;
  outOfStock: string;
  inventoryValue: string;
}

export class PrismaSellerDashboardRepository
  implements SellerDashboardRepository
{
  constructor(private readonly client: PrismaClient) {}

  async getDashboard(
    sellerId: string,
    period: SellerDashboardPeriod,
  ): Promise<SellerDashboardSummary> {
    const sellerOrderWhere = sellerOrderFilter(sellerId);

    const [
      totalProducts,
      activeProducts,
      orderCounts,
      paymentVerified,
      revenueRows,
      recentOrders,
    ] = await Promise.all([
      this.client.product.count({ where: { sellerId } }),
      this.client.product.count({
        where: {
          sellerId,
          quantity: { gt: 0 },
        },
      }),
      this.client.order.groupBy({
        by: ["status"],
        where: sellerOrderWhere,
        _count: { _all: true },
      }),
      this.client.payment.count({
        where: {
          status: PrismaPaymentStatus.VERIFIED,
          order: {
            is: sellerOrderFilter(sellerId),
          },
        },
      }),
      this.client.$queryRaw<RevenueRow[]>(Prisma.sql`
        SELECT
          COALESCE(SUM(oi."quantity" * oi."price"), 0)::text
            AS "totalRevenue",
          COALESCE(
            SUM(
              CASE
                WHEN o."createdAt" >= ${period.monthStart}
                  AND o."createdAt" < ${period.nextMonthStart}
                THEN oi."quantity" * oi."price"
                ELSE 0
              END
            ),
            0
          )::text AS "monthlyRevenue"
        FROM "order_items" oi
        INNER JOIN "products" p ON p."id" = oi."productId"
        INNER JOIN "orders" o ON o."id" = oi."orderId"
        WHERE p."sellerId" = ${sellerId}::uuid
          AND o."status" = 'DELIVERED'
      `),
      this.client.order.findMany({
        where: sellerOrderWhere,
        include: sellerOrderInclude(sellerId),
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 10,
      }),
    ]);

    const counts = new Map(
      orderCounts.map((entry) => [entry.status, entry._count._all]),
    );
    const revenue = revenueRows[0];

    return {
      totalProducts,
      activeProducts,
      totalOrders: orderCounts.reduce(
        (total, entry) => total + entry._count._all,
        0,
      ),
      pendingOrders: counts.get("PENDING") ?? 0,
      completedOrders: counts.get("DELIVERED") ?? 0,
      cancelledOrders: counts.get("CANCELLED") ?? 0,
      totalRevenue: formatMoney(revenue?.totalRevenue),
      monthlyRevenue: formatMoney(revenue?.monthlyRevenue),
      pendingPaymentVerification:
        counts.get("PENDING_PAYMENT_VERIFICATION") ?? 0,
      paymentVerified,
      processing: counts.get("PROCESSING") ?? 0,
      readyForDelivery: counts.get("READY_FOR_DELIVERY") ?? 0,
      outForDelivery: counts.get("OUT_FOR_DELIVERY") ?? 0,
      delivered: counts.get("DELIVERED") ?? 0,
      recentOrders: recentOrders.map(mapSellerOrder),
    };
  }

  async findProducts(
    sellerId: string,
    query: SellerProductQuery,
  ): Promise<SellerProductsResult> {
    const where: Prisma.ProductWhereInput = {
      sellerId,
      ...(query.search !== undefined
        ? {
            OR: [
              {
                name: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
              {
                description: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
              {
                category: {
                  is: {
                    name: {
                      contains: query.search,
                      mode: "insensitive",
                    },
                  },
                },
              },
            ],
          }
        : {}),
      ...(query.categoryId !== undefined
        ? { categoryId: query.categoryId }
        : {}),
      ...(query.stock !== undefined
        ? { quantity: stockFilter(query.stock) }
        : {}),
    };

    const [total, products, inventoryRows] = await this.client.$transaction([
      this.client.product.count({ where }),
      this.client.product.findMany({
        where,
        include: productRelations,
        orderBy: productOrderBy(query),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.client.$queryRaw<InventorySummaryRow[]>(Prisma.sql`
        SELECT
          COUNT(*)::text AS "totalProducts",
          COUNT(*) FILTER (
            WHERE "quantity" > 0 AND "quantity" <= 10
          )::text AS "lowStock",
          COUNT(*) FILTER (
            WHERE "quantity" = 0
          )::text AS "outOfStock",
          COALESCE(SUM("price" * "quantity"), 0)::text
            AS "inventoryValue"
        FROM "products"
        WHERE "sellerId" = ${sellerId}::uuid
      `),
    ]);
    const inventorySummary = inventoryRows[0];

    return {
      products: products.map(mapProduct),
      pagination: pagination(query.page, query.limit, total),
      inventorySummary: {
        totalProducts: Number(inventorySummary?.totalProducts ?? 0),
        lowStock: Number(inventorySummary?.lowStock ?? 0),
        outOfStock: Number(inventorySummary?.outOfStock ?? 0),
        inventoryValue: formatMoney(inventorySummary?.inventoryValue),
      },
    };
  }

  async findOrders(
    sellerId: string,
    query: SellerOrderQuery,
  ): Promise<SellerOrdersResult> {
    const where: Prisma.OrderWhereInput = {
      ...sellerOrderFilter(sellerId),
      ...(query.status !== undefined
        ? { status: sellerOrderWorkflowStatusFilter(query.status) }
        : {}),
      ...(query.dateFrom !== undefined ||
      query.dateToExclusive !== undefined
        ? {
            createdAt: {
              ...(query.dateFrom !== undefined
                ? { gte: query.dateFrom }
                : {}),
              ...(query.dateToExclusive !== undefined
                ? { lt: query.dateToExclusive }
                : {}),
            },
          }
        : {}),
      ...(query.customerSearch !== undefined
        ? {
            customer: {
              is: {
                OR: [
                  {
                    name: {
                      contains: query.customerSearch,
                      mode: "insensitive",
                    },
                  },
                  {
                    email: {
                      contains: query.customerSearch,
                      mode: "insensitive",
                    },
                  },
                ],
              },
            },
          }
        : {}),
    };

    const [total, orders] = await this.client.$transaction([
      this.client.order.count({ where }),
      this.client.order.findMany({
        where,
        include: sellerOrderInclude(sellerId),
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      orders: orders.map(mapSellerOrder),
      pagination: pagination(query.page, query.limit, total),
    };
  }

  async findOrderById(
    sellerId: string,
    orderId: string,
  ): Promise<SellerOrderEntity | null> {
    const order = await this.client.order.findFirst({
      where: {
        id: orderId,
        ...sellerOrderFilter(sellerId),
      },
      include: sellerOrderInclude(sellerId),
    });

    return order ? mapSellerOrder(order) : null;
  }

  async verifyPayment(
    sellerId: string,
    orderId: string,
    decision: "APPROVE" | "REJECT",
  ): Promise<SellerOrderEntity | null> {
    return this.client.$transaction(async (transaction) => {
      const order = await transaction.order.findFirst({
        where: {
          id: orderId,
          ...sellerOrderFilter(sellerId),
        },
        select: {
          status: true,
          payment: {
            select: { status: true },
          },
        },
      });

      if (!order) {
        return null;
      }
      if (
        order.status !==
          PrismaOrderStatus.PENDING_PAYMENT_VERIFICATION ||
        order.payment?.status !== PrismaPaymentStatus.PENDING_VERIFICATION
      ) {
        throw new SellerOrderStateChangedError();
      }

      const paymentStatus =
        decision === "APPROVE"
          ? PrismaPaymentStatus.VERIFIED
          : PrismaPaymentStatus.REJECTED;
      const orderStatus =
        decision === "APPROVE"
          ? PrismaOrderStatus.CONFIRMED
          : PrismaOrderStatus.PAYMENT_REJECTED;
      const paymentUpdate = await transaction.payment.updateMany({
        where: {
          orderId,
          status: PrismaPaymentStatus.PENDING_VERIFICATION,
        },
        data: {
          status: paymentStatus,
          verifiedAt: decision === "APPROVE" ? new Date() : null,
        },
      });
      const orderUpdate = await transaction.order.updateMany({
        where: {
          id: orderId,
          status: PrismaOrderStatus.PENDING_PAYMENT_VERIFICATION,
        },
        data: { status: orderStatus },
      });

      if (paymentUpdate.count !== 1 || orderUpdate.count !== 1) {
        throw new SellerOrderStateChangedError();
      }
      if (decision === "REJECT") {
        await restoreOrderInventory(transaction, orderId);
      }

      const updated = await transaction.order.findUnique({
        where: { id: orderId },
        include: sellerOrderInclude(sellerId),
      });

      return updated ? mapSellerOrder(updated) : null;
    });
  }

  async updateOrderStatus(
    sellerId: string,
    orderId: string,
    expectedStatus: OrderStatus,
    status: OrderStatus,
  ): Promise<SellerOrderEntity | null> {
    return this.client.$transaction(async (transaction) => {
      const ownedOrder = await transaction.order.findFirst({
        where: {
          id: orderId,
          ...sellerOrderFilter(sellerId),
        },
        select: {
          id: true,
        },
      });
      if (!ownedOrder) {
        return null;
      }

      const update = await transaction.order.updateMany({
        where: {
          id: orderId,
          status: PrismaOrderStatus[expectedStatus],
        },
        data: {
          status: PrismaOrderStatus[status],
        },
      });
      if (update.count !== 1) {
        throw new SellerOrderStateChangedError();
      }
      if (status === "CANCELLED") {
        await restoreOrderInventory(transaction, orderId);
      }

      const updated = await transaction.order.findUnique({
        where: { id: orderId },
        include: sellerOrderInclude(sellerId),
      });

      return updated ? mapSellerOrder(updated) : null;
    });
  }

  async getAnalytics(
    sellerId: string,
    period: SellerAnalyticsPeriod,
  ): Promise<SellerAnalytics> {
    const [bestSellingRows, monthlyRows, orderCounts, topCategoryRows] =
      await Promise.all([
        this.client.$queryRaw<BestSellingRow[]>(Prisma.sql`
          SELECT
            p."id" AS "productId",
            p."name" AS "name",
            SUM(oi."quantity")::text AS "unitsSold",
            SUM(oi."quantity" * oi."price")::text AS "revenue"
          FROM "order_items" oi
          INNER JOIN "products" p ON p."id" = oi."productId"
          INNER JOIN "orders" o ON o."id" = oi."orderId"
          WHERE p."sellerId" = ${sellerId}::uuid
            AND o."status" = 'DELIVERED'
          GROUP BY p."id", p."name"
          ORDER BY SUM(oi."quantity") DESC,
            SUM(oi."quantity" * oi."price") DESC,
            p."name" ASC
          LIMIT 10
        `),
        this.client.$queryRaw<MonthlySalesRow[]>(Prisma.sql`
          SELECT
            TO_CHAR(DATE_TRUNC('month', o."createdAt"), 'YYYY-MM')
              AS "month",
            COUNT(DISTINCT o."id")::text AS "orders",
            SUM(oi."quantity")::text AS "unitsSold",
            SUM(oi."quantity" * oi."price")::text AS "revenue"
          FROM "order_items" oi
          INNER JOIN "products" p ON p."id" = oi."productId"
          INNER JOIN "orders" o ON o."id" = oi."orderId"
          WHERE p."sellerId" = ${sellerId}::uuid
            AND o."status" = 'DELIVERED'
            AND o."createdAt" >= ${period.startDate}
            AND o."createdAt" < ${period.endDate}
          GROUP BY DATE_TRUNC('month', o."createdAt")
          ORDER BY DATE_TRUNC('month', o."createdAt") ASC
        `),
        this.client.order.groupBy({
          by: ["status"],
          where: sellerOrderFilter(sellerId),
          _count: { _all: true },
        }),
        this.client.$queryRaw<TopCategoryRow[]>(Prisma.sql`
          SELECT
            c."id" AS "categoryId",
            c."name" AS "name",
            SUM(oi."quantity")::text AS "unitsSold",
            SUM(oi."quantity" * oi."price")::text AS "revenue"
          FROM "order_items" oi
          INNER JOIN "products" p ON p."id" = oi."productId"
          INNER JOIN "categories" c ON c."id" = p."categoryId"
          INNER JOIN "orders" o ON o."id" = oi."orderId"
          WHERE p."sellerId" = ${sellerId}::uuid
            AND o."status" = 'DELIVERED'
          GROUP BY c."id", c."name"
          ORDER BY SUM(oi."quantity" * oi."price") DESC,
            SUM(oi."quantity") DESC,
            c."name" ASC
          LIMIT 10
        `),
      ]);

    const statusCounts = new Map(
      orderCounts.map((entry) => [entry.status, entry._count._all]),
    );

    return {
      period: {
        startDate: period.startDate,
        endDate: period.endDate,
      },
      bestSellingProducts: bestSellingRows.map((row) => ({
        productId: row.productId,
        name: row.name,
        unitsSold: Number(row.unitsSold),
        revenue: formatMoney(row.revenue),
      })),
      monthlySales: monthlyRows.map((row) => ({
        month: row.month,
        orders: Number(row.orders),
        unitsSold: Number(row.unitsSold),
      })),
      revenueByMonth: monthlyRows.map((row) => ({
        month: row.month,
        revenue: formatMoney(row.revenue),
      })),
      ordersByStatus: orderStatuses.map((status) => ({
        status,
        count: statusCounts.get(status) ?? 0,
      })),
      topCategories: topCategoryRows.map((row) => ({
        categoryId: row.categoryId,
        name: row.name,
        unitsSold: Number(row.unitsSold),
        revenue: formatMoney(row.revenue),
      })),
    };
  }
}

function sellerOrderFilter(sellerId: string): Prisma.OrderWhereInput {
  return {
    items: {
      some: {
        product: {
          is: { sellerId },
        },
      },
    },
  };
}

function sellerOrderWorkflowStatusFilter(
  status: OrderStatus,
): Exclude<Prisma.OrderWhereInput["status"], undefined> {
  switch (status) {
    case "PENDING":
      return {
        in: [
          PrismaOrderStatus.PENDING_PAYMENT,
          PrismaOrderStatus.PENDING_PAYMENT_VERIFICATION,
          PrismaOrderStatus.PENDING_CONFIRMATION,
          PrismaOrderStatus.PENDING,
        ],
      };
    case "CONFIRMED":
      return {
        in: [
          PrismaOrderStatus.PAYMENT_VERIFIED,
          PrismaOrderStatus.CONFIRMED,
        ],
      };
    case "PROCESSING":
      return {
        in: [
          PrismaOrderStatus.PROCESSING,
          PrismaOrderStatus.READY_FOR_DELIVERY,
        ],
      };
    case "SHIPPED":
      return {
        in: [
          PrismaOrderStatus.OUT_FOR_DELIVERY,
          PrismaOrderStatus.SHIPPED,
        ],
      };
    case "CANCELLED":
      return {
        in: [
          PrismaOrderStatus.PAYMENT_REJECTED,
          PrismaOrderStatus.REJECTED,
          PrismaOrderStatus.CANCELLED,
        ],
      };
    default:
      return PrismaOrderStatus[status];
  }
}

function sellerOrderInclude(sellerId: string) {
  return {
    customer: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
    payment: true,
    items: {
      where: {
        product: {
          is: { sellerId },
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        id: "asc" as const,
      },
    },
  };
}

function mapProduct(product: ProductWithRelations): ProductEntity {
  return {
    id: product.id,
    sellerId: product.sellerId,
    categoryId: product.categoryId,
    name: product.name,
    description: product.description,
    price: product.price.toFixed(2),
    quantity: product.quantity,
    imageUrl: product.imageUrl,
    seller: product.seller,
    category: product.category,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function mapSellerOrder(order: SellerOrderWithRelations): SellerOrderEntity {
  let sellerTotal = new Prisma.Decimal(0);
  let totalItems = 0;

  const items = order.items.map((item) => {
    const lineTotal = item.price.mul(item.quantity);
    sellerTotal = sellerTotal.plus(lineTotal);
    totalItems += item.quantity;

    return {
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      price: item.price.toFixed(2),
      lineTotal: lineTotal.toFixed(2),
      product: item.product,
    };
  });

  return {
    id: order.id,
    customerId: order.customerId,
    customer: order.customer,
    status: order.status as OrderStatus,
    paymentMethod: order.paymentMethod,
    shippingFullName: order.shippingFullName,
    shippingPhone: order.shippingPhone,
    shippingCity: order.shippingCity,
    shippingAddress: order.shippingAddress,
    shippingNotes: order.shippingNotes,
    payment: order.payment
      ? {
          id: order.payment.id,
          method: order.payment.method,
          providerName: order.payment.providerName,
          proofImageUrl: order.payment.proofImageUrl,
          status: order.payment.status,
          createdAt: order.payment.createdAt,
          verifiedAt: order.payment.verifiedAt,
        }
      : null,
    sellerTotal: sellerTotal.toFixed(2),
    totalItems,
    items,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function stockFilter(
  stock: SellerProductQuery["stock"],
): Prisma.IntFilter {
  switch (stock) {
    case "in_stock":
      return { gt: 0 };
    case "low_stock":
      return { gt: 0, lte: 10 };
    case "out_of_stock":
      return { equals: 0 };
    default:
      return {};
  }
}

function productOrderBy(
  query: SellerProductQuery,
): Prisma.ProductOrderByWithRelationInput[] {
  switch (query.sortBy) {
    case "name":
      return [{ name: query.sortOrder }, { id: "asc" }];
    case "price":
      return [{ price: query.sortOrder }, { id: "asc" }];
    case "quantity":
      return [{ quantity: query.sortOrder }, { id: "asc" }];
    case "createdAt":
      return [{ createdAt: query.sortOrder }, { id: "asc" }];
  }
}

function pagination(
  page: number,
  limit: number,
  total: number,
) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

function formatMoney(value: string | undefined): string {
  return new Prisma.Decimal(value ?? 0).toFixed(2);
}
