import {
  OrderStatus,
  Prisma,
  Role,
  type PrismaClient,
} from "../prisma/generated/client.js";
import { AdminProductInUseError } from "./admin-dashboard.errors.js";
import type {
  AdminDashboardPeriod,
  AdminDashboardRepository,
  AdminDashboardSummary,
  AdminPagination,
  AdminProductEntity,
  AdminProductQuery,
  AdminProductsResult,
  AdminSellerQuery,
  AdminSellersResult,
  AdminUserEntity,
  AdminUserQuery,
  AdminUsersResult,
} from "./admin-dashboard.repository.js";

const adminUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  company: true,
  role: true,
  isActive: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const adminSellerSelect = {
  ...adminUserSelect,
  sellerProfile: {
    select: {
      shopName: true,
      phone: true,
      address: true,
    },
  },
  _count: {
    select: {
      listedProducts: true,
    },
  },
} satisfies Prisma.UserSelect;

const adminProductRelations = {
  seller: {
    select: {
      id: true,
      name: true,
      email: true,
      sellerProfile: {
        select: {
          shopName: true,
        },
      },
    },
  },
  category: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.ProductInclude;

type AdminUserRecord = Prisma.UserGetPayload<{
  select: typeof adminUserSelect;
}>;

type AdminSellerRecord = Prisma.UserGetPayload<{
  select: typeof adminSellerSelect;
}>;

type AdminProductRecord = Prisma.ProductGetPayload<{
  include: typeof adminProductRelations;
}>;

interface SellerAggregateRow {
  sellerId: string;
  orderCount: string;
  revenue: string;
}

export class PrismaAdminDashboardRepository
  implements AdminDashboardRepository
{
  constructor(private readonly client: PrismaClient) {}

  async getDashboard(
    period: AdminDashboardPeriod,
  ): Promise<AdminDashboardSummary> {
    const [
      totalUsers,
      totalCustomers,
      totalSellers,
      totalProducts,
      totalCategories,
      totalOrders,
      totalRevenue,
      monthlyRevenue,
      recentUsers,
      recentProducts,
      recentOrders,
    ] = await Promise.all([
      this.client.user.count(),
      this.client.user.count({ where: { role: Role.CUSTOMER } }),
      this.client.user.count({ where: { role: Role.SELLER } }),
      this.client.product.count(),
      this.client.category.count(),
      this.client.order.count(),
      this.client.order.aggregate({
        where: { status: OrderStatus.DELIVERED },
        _sum: { totalAmount: true },
      }),
      this.client.order.aggregate({
        where: {
          status: OrderStatus.DELIVERED,
          createdAt: {
            gte: period.monthStart,
            lt: period.nextMonthStart,
          },
        },
        _sum: { totalAmount: true },
      }),
      this.client.user.findMany({
        select: {
          id: true,
          name: true,
          role: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 5,
      }),
      this.client.product.findMany({
        select: {
          id: true,
          name: true,
          createdAt: true,
          seller: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 5,
      }),
      this.client.order.findMany({
        select: {
          id: true,
          status: true,
          createdAt: true,
          customer: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 5,
      }),
    ]);

    const recentActivity = [
      ...recentUsers.map((user) => ({
        type: "USER_REGISTERED" as const,
        entityId: user.id,
        label: `${user.name} registered as ${user.role.toLowerCase()}.`,
        createdAt: user.createdAt,
      })),
      ...recentProducts.map((product) => ({
        type: "PRODUCT_CREATED" as const,
        entityId: product.id,
        label: `${product.seller.name} added ${product.name}.`,
        createdAt: product.createdAt,
      })),
      ...recentOrders.map((order) => ({
        type: "ORDER_CREATED" as const,
        entityId: order.id,
        label: `${order.customer.name} placed a ${order.status.toLowerCase()} order.`,
        createdAt: order.createdAt,
      })),
    ]
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() ||
          left.type.localeCompare(right.type) ||
          left.entityId.localeCompare(right.entityId),
      )
      .slice(0, 10);

    return {
      totalUsers,
      totalCustomers,
      totalSellers,
      totalProducts,
      totalCategories,
      totalOrders,
      totalRevenue: formatMoney(totalRevenue._sum.totalAmount),
      monthlyRevenue: formatMoney(monthlyRevenue._sum.totalAmount),
      recentActivity,
    };
  }

  async findUsers(query: AdminUserQuery): Promise<AdminUsersResult> {
    const where: Prisma.UserWhereInput = {
      ...(query.role !== undefined ? { role: Role[query.role] } : {}),
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
                email: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
              {
                company: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };
    const [total, users] = await this.client.$transaction([
      this.client.user.count({ where }),
      this.client.user.findMany({
        where,
        select: adminUserSelect,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      users: users.map(mapAdminUser),
      pagination: pagination(query.page, query.limit, total),
    };
  }

  async updateUserStatus(
    id: string,
    isActive: boolean,
  ): Promise<AdminUserEntity | null> {
    try {
      const user = await this.client.user.update({
        where: { id },
        data: {
          isActive,
          ...(!isActive ? { refreshToken: null } : {}),
        },
        select: adminUserSelect,
      });

      return mapAdminUser(user);
    } catch (error) {
      if (hasPrismaCode(error, "P2025")) {
        return null;
      }
      throw error;
    }
  }

  async findSellers(query: AdminSellerQuery): Promise<AdminSellersResult> {
    const where: Prisma.UserWhereInput = {
      role: Role.SELLER,
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
                email: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
              {
                company: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
              {
                sellerProfile: {
                  is: {
                    shopName: {
                      contains: query.search,
                      mode: "insensitive",
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [total, sellers] = await this.client.$transaction([
      this.client.user.count({ where }),
      this.client.user.findMany({
        where,
        select: adminSellerSelect,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    const aggregates = await this.findSellerAggregates(
      sellers.map((seller) => seller.id),
    );

    return {
      sellers: sellers.map((seller) => {
        const aggregate = aggregates.get(seller.id);

        return {
          id: seller.id,
          name: seller.name,
          email: seller.email,
          phone: seller.phone,
          company: seller.company,
          shopName: seller.sellerProfile?.shopName ?? null,
          shopPhone: seller.sellerProfile?.phone ?? null,
          address: seller.sellerProfile?.address ?? null,
          status: seller.isActive ? "ACTIVE" : "DISABLED",
          productCount: seller._count.listedProducts,
          orderCount: aggregate?.orderCount ?? 0,
          revenue: aggregate?.revenue ?? "0.00",
          createdAt: seller.createdAt,
          updatedAt: seller.updatedAt,
        };
      }),
      pagination: pagination(query.page, query.limit, total),
    };
  }

  async findProducts(query: AdminProductQuery): Promise<AdminProductsResult> {
    const where: Prisma.ProductWhereInput = {
      ...(query.categoryId !== undefined
        ? { categoryId: query.categoryId }
        : {}),
      ...(query.sellerId !== undefined ? { sellerId: query.sellerId } : {}),
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
              {
                seller: {
                  is: {
                    name: {
                      contains: query.search,
                      mode: "insensitive",
                    },
                  },
                },
              },
              {
                seller: {
                  is: {
                    email: {
                      contains: query.search,
                      mode: "insensitive",
                    },
                  },
                },
              },
              {
                seller: {
                  is: {
                    sellerProfile: {
                      is: {
                        shopName: {
                          contains: query.search,
                          mode: "insensitive",
                        },
                      },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [total, products] = await this.client.$transaction([
      this.client.product.count({ where }),
      this.client.product.findMany({
        where,
        include: adminProductRelations,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      products: products.map(mapAdminProduct),
      pagination: pagination(query.page, query.limit, total),
    };
  }

  async deleteProduct(id: string): Promise<boolean> {
    try {
      await this.client.product.delete({ where: { id } });
      return true;
    } catch (error) {
      if (hasPrismaCode(error, "P2025")) {
        return false;
      }
      if (hasPrismaCode(error, "P2003")) {
        throw new AdminProductInUseError();
      }
      throw error;
    }
  }

  private async findSellerAggregates(
    sellerIds: string[],
  ): Promise<Map<string, { orderCount: number; revenue: string }>> {
    if (sellerIds.length === 0) {
      return new Map();
    }

    const sellerIdList = Prisma.join(
      sellerIds.map((sellerId) => Prisma.sql`${sellerId}::uuid`),
    );
    const rows = await this.client.$queryRaw<SellerAggregateRow[]>(Prisma.sql`
      SELECT
        p."sellerId" AS "sellerId",
        COUNT(DISTINCT oi."orderId")::text AS "orderCount",
        COALESCE(
          SUM(
            CASE
              WHEN o."status" = 'DELIVERED'
              THEN oi."quantity" * oi."price"
              ELSE 0
            END
          ),
          0
        )::text AS "revenue"
      FROM "order_items" oi
      INNER JOIN "products" p ON p."id" = oi."productId"
      INNER JOIN "orders" o ON o."id" = oi."orderId"
      WHERE p."sellerId" IN (${sellerIdList})
      GROUP BY p."sellerId"
    `);

    return new Map(
      rows.map((row) => [
        row.sellerId,
        {
          orderCount: Number(row.orderCount),
          revenue: formatMoney(row.revenue),
        },
      ]),
    );
  }
}

function mapAdminUser(user: AdminUserRecord): AdminUserEntity {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    company: user.company,
    role: user.role,
    status: user.isActive ? "ACTIVE" : "DISABLED",
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function mapAdminProduct(product: AdminProductRecord): AdminProductEntity {
  return {
    id: product.id,
    sellerId: product.sellerId,
    categoryId: product.categoryId,
    name: product.name,
    description: product.description,
    price: product.price.toFixed(2),
    quantity: product.quantity,
    imageUrl: product.imageUrl,
    seller: {
      id: product.seller.id,
      name: product.seller.name,
      email: product.seller.email,
      shopName: product.seller.sellerProfile?.shopName ?? null,
    },
    category: product.category,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function pagination(
  page: number,
  limit: number,
  total: number,
): AdminPagination {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

function formatMoney(
  value: Prisma.Decimal | string | number | null | undefined,
): string {
  return new Prisma.Decimal(value ?? 0).toFixed(2);
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}
