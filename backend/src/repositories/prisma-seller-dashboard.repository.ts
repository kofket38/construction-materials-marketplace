import {
  Prisma,
  type PrismaClient,
} from "../prisma/generated/client.js";
import type { OrderStatus } from "./order.repository.js";
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

    const [total, products] = await this.client.$transaction([
      this.client.product.count({ where }),
      this.client.product.findMany({
        where,
        include: productRelations,
        orderBy: productOrderBy(query),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      products: products.map(mapProduct),
      pagination: pagination(query.page, query.limit, total),
    };
  }

  async findOrders(
    sellerId: string,
    query: SellerOrderQuery,
  ): Promise<SellerOrdersResult> {
    const where: Prisma.OrderWhereInput = {
      ...sellerOrderFilter(sellerId),
      ...(query.status !== undefined ? { status: query.status } : {}),
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

function sellerOrderInclude(sellerId: string) {
  return {
    customer: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
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
