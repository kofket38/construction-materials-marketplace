import {
  Prisma,
  type PrismaClient,
} from "../src/prisma/generated/client.js";
import { AdminProductInUseError } from "../src/repositories/admin-dashboard.errors.js";
import { PrismaAdminDashboardRepository } from "../src/repositories/prisma-admin-dashboard.repository.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("PrismaAdminDashboardRepository", () => {
  let client: ReturnType<typeof createPrismaClientMock>;
  let repository: PrismaAdminDashboardRepository;

  beforeEach(() => {
    client = createPrismaClientMock();
    repository = new PrismaAdminDashboardRepository(
      client as unknown as PrismaClient,
    );
  });

  it("maps dashboard totals, delivered revenue, and recent activity", async () => {
    client.user.count
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);
    client.product.count.mockResolvedValue(5);
    client.category.count.mockResolvedValue(4);
    client.order.count.mockResolvedValue(6);
    client.order.aggregate
      .mockResolvedValueOnce({
        _sum: { totalAmount: new Prisma.Decimal("1250.50") },
      })
      .mockResolvedValueOnce({
        _sum: { totalAmount: new Prisma.Decimal("450.25") },
      });
    client.user.findMany.mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000001",
        name: "New Seller",
        role: "SELLER",
        createdAt: new Date("2026-07-18T08:00:00.000Z"),
      },
    ]);
    client.product.findMany.mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000002",
        name: "Cement",
        createdAt: new Date("2026-07-19T08:00:00.000Z"),
        seller: { name: "New Seller" },
      },
    ]);
    client.order.findMany.mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000003",
        status: "PENDING",
        createdAt: new Date("2026-07-20T08:00:00.000Z"),
        customer: { name: "New Customer" },
      },
    ]);

    const result = await repository.getDashboard({
      monthStart: new Date("2026-07-01T00:00:00.000Z"),
      nextMonthStart: new Date("2026-08-01T00:00:00.000Z"),
    });

    expect(result).toMatchObject({
      totalUsers: 7,
      totalCustomers: 3,
      totalSellers: 2,
      totalProducts: 5,
      totalCategories: 4,
      totalOrders: 6,
      totalRevenue: "1250.50",
      monthlyRevenue: "450.25",
    });
    expect(result.recentActivity).toEqual([
      {
        type: "ORDER_CREATED",
        entityId: "00000000-0000-4000-8000-000000000003",
        label: "New Customer placed a pending order.",
        createdAt: new Date("2026-07-20T08:00:00.000Z"),
      },
      {
        type: "PRODUCT_CREATED",
        entityId: "00000000-0000-4000-8000-000000000002",
        label: "New Seller added Cement.",
        createdAt: new Date("2026-07-19T08:00:00.000Z"),
      },
      {
        type: "USER_REGISTERED",
        entityId: "00000000-0000-4000-8000-000000000001",
        label: "New Seller registered as seller.",
        createdAt: new Date("2026-07-18T08:00:00.000Z"),
      },
    ]);
    expect(client.order.aggregate).toHaveBeenNthCalledWith(2, {
      where: {
        status: {
          in: ["DELIVERED", "COMPLETED"],
        },
        createdAt: {
          gte: new Date("2026-07-01T00:00:00.000Z"),
          lt: new Date("2026-08-01T00:00:00.000Z"),
        },
      },
      _sum: { totalAmount: true },
    });
  });

  it("maps paginated users and clears refresh tokens when disabling them", async () => {
    const userRecord = {
      id: "00000000-0000-4000-8000-000000000011",
      name: "Amina Kamau",
      email: "amina@example.com",
      phone: "+254700000001",
      company: "Kamau Supplies",
      role: "SELLER",
      isActive: true,
      emailVerified: false,
      createdAt: new Date("2026-07-10T08:00:00.000Z"),
      updatedAt: new Date("2026-07-11T08:00:00.000Z"),
    };
    client.user.count.mockResolvedValue(1);
    client.user.findMany.mockResolvedValue([userRecord]);

    const result = await repository.findUsers({
      page: 2,
      limit: 10,
      search: "amina",
      role: "SELLER",
    });

    expect(result).toEqual({
      users: [
        {
          id: userRecord.id,
          name: userRecord.name,
          email: userRecord.email,
          phone: userRecord.phone,
          company: userRecord.company,
          role: "SELLER",
          status: "ACTIVE",
          emailVerified: false,
          createdAt: userRecord.createdAt,
          updatedAt: userRecord.updatedAt,
        },
      ],
      pagination: {
        page: 2,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    });
    expect(client.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        where: expect.objectContaining({ role: "SELLER" }),
      }),
    );

    client.user.update.mockResolvedValue({
      ...userRecord,
      isActive: false,
    });
    const disabled = await repository.updateUserStatus(userRecord.id, false);

    expect(disabled?.status).toBe("DISABLED");
    expect(client.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: userRecord.id },
        data: {
          isActive: false,
          refreshToken: null,
        },
      }),
    );

    client.user.update.mockRejectedValueOnce(prismaError("P2025"));
    await expect(
      repository.updateUserStatus(
        "00000000-0000-4000-8000-000000000099",
        true,
      ),
    ).resolves.toBeNull();
  });

  it("maps seller profiles and seller-scoped order aggregates", async () => {
    client.user.count.mockResolvedValue(1);
    client.user.findMany.mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000021",
        name: "Seller One",
        email: "seller@example.com",
        phone: "+254700000001",
        company: "Seller Company",
        role: "SELLER",
        isActive: true,
        emailVerified: true,
        createdAt: new Date("2026-07-01T08:00:00.000Z"),
        updatedAt: new Date("2026-07-02T08:00:00.000Z"),
        sellerProfile: {
          shopName: "Seller Shop",
          phone: "+254700000002",
          address: "Nairobi",
        },
        _count: {
          listedProducts: 3,
        },
      },
    ]);
    client.$queryRaw.mockResolvedValue([
      {
        sellerId: "00000000-0000-4000-8000-000000000021",
        orderCount: "4",
        revenue: "987.5",
      },
    ]);

    const result = await repository.findSellers({
      page: 1,
      limit: 20,
      search: "seller",
    });

    expect(result.sellers).toEqual([
      expect.objectContaining({
        id: "00000000-0000-4000-8000-000000000021",
        shopName: "Seller Shop",
        shopPhone: "+254700000002",
        address: "Nairobi",
        status: "ACTIVE",
        productCount: 3,
        orderCount: 4,
        revenue: "987.50",
      }),
    ]);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it("maps product relations and translates deletion outcomes", async () => {
    const productId = "00000000-0000-4000-8000-000000000031";
    client.product.count.mockResolvedValue(1);
    client.product.findMany.mockResolvedValue([
      {
        id: productId,
        sellerId: "00000000-0000-4000-8000-000000000032",
        categoryId: "00000000-0000-4000-8000-000000000033",
        name: "Portland Cement",
        description: "Bagged cement",
        price: new Prisma.Decimal("850"),
        quantity: 12,
        imageUrl: "https://example.com/cement.jpg",
        seller: {
          id: "00000000-0000-4000-8000-000000000032",
          name: "Seller One",
          email: "seller@example.com",
          sellerProfile: {
            shopName: "Seller Shop",
          },
        },
        category: {
          id: "00000000-0000-4000-8000-000000000033",
          name: "Cement",
        },
        createdAt: new Date("2026-07-01T08:00:00.000Z"),
        updatedAt: new Date("2026-07-02T08:00:00.000Z"),
      },
    ]);

    const result = await repository.findProducts({
      page: 1,
      limit: 20,
      search: "cement",
    });

    expect(result.products).toEqual([
      expect.objectContaining({
        id: productId,
        price: "850.00",
        seller: {
          id: "00000000-0000-4000-8000-000000000032",
          name: "Seller One",
          email: "seller@example.com",
          shopName: "Seller Shop",
        },
        category: {
          id: "00000000-0000-4000-8000-000000000033",
          name: "Cement",
        },
      }),
    ]);

    client.product.delete.mockResolvedValueOnce({ id: productId });
    await expect(repository.deleteProduct(productId)).resolves.toBe(true);

    client.product.delete.mockRejectedValueOnce(prismaError("P2025"));
    await expect(repository.deleteProduct(productId)).resolves.toBe(false);

    client.product.delete.mockRejectedValueOnce(prismaError("P2003"));
    await expect(repository.deleteProduct(productId)).rejects.toBeInstanceOf(
      AdminProductInUseError,
    );
  });
});

function createPrismaClientMock() {
  return {
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    product: {
      count: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    category: {
      count: vi.fn(),
    },
    order: {
      count: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (operations: unknown[]) =>
      Promise.all(operations),
    ),
    $queryRaw: vi.fn(),
  };
}

function prismaError(code: string): Error & { code: string } {
  return Object.assign(new Error(`Prisma error ${code}`), { code });
}
