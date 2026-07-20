import { randomUUID } from "node:crypto";
import pino from "pino";
import request, { type Response } from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { JwtTokenService } from "../src/services/token.service.js";
import { InMemoryAdminDashboardRepository } from "./helpers/in-memory-admin-dashboard.repository.js";
import { InMemoryUserRepository } from "./helpers/in-memory-user.repository.js";

const adminId = randomUUID();
const customerId = randomUUID();
const firstSellerId = randomUUID();
const secondSellerId = randomUUID();
const cementCategoryId = randomUUID();
const steelCategoryId = randomUUID();
const cementProductId = randomUUID();
const steelProductId = randomUUID();
const aggregateProductId = randomUUID();
const removableProductId = randomUUID();

describe("Admin Dashboard API", () => {
  const tokenService = new JwtTokenService();
  let app: ReturnType<typeof createApp>;
  let users: InMemoryUserRepository;
  let dashboard: InMemoryAdminDashboardRepository;
  let adminToken: string;
  let customerToken: string;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    seedUsers();
    dashboard = new InMemoryAdminDashboardRepository(users);
    seedMarketplace();

    app = createApp({
      adminDashboardRepository: dashboard,
      userRepository: users,
      tokenService,
      logger: pino({ level: "silent" }),
    });

    adminToken = tokenService.createAccessToken({
      userId: adminId,
      role: "ADMIN",
    });
    customerToken = tokenService.createAccessToken({
      userId: customerId,
      role: "CUSTOMER",
    });
  });

  it("returns marketplace totals, revenue, and recent activity", async () => {
    const response = await adminGet("/api/admin/dashboard").expect(200);

    expect(response.body.data.dashboard).toMatchObject({
      totalUsers: 4,
      totalCustomers: 1,
      totalSellers: 2,
      totalProducts: 4,
      totalCategories: 2,
      totalOrders: 3,
      totalRevenue: "850.00",
      monthlyRevenue: "250.00",
    });
    expect(response.body.data.dashboard.recentActivity).toHaveLength(10);
    expect(response.body.data.dashboard.recentActivity[0]).toMatchObject({
      type: "ORDER_CREATED",
      entityId: "00000000-0000-4000-8000-000000000303",
    });
  });

  it("lists and filters users with stable pagination", async () => {
    const response = await adminGet(
      "/api/admin/users?role=SELLER&page=1&limit=1",
    ).expect(200);

    expect(response.body.data.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
    });
    expect(response.body.data.users).toHaveLength(1);
    expect(response.body.data.users[0]).toMatchObject({
      id: secondSellerId,
      role: "SELLER",
      status: "ACTIVE",
    });

    const searchResponse = await adminGet(
      "/api/admin/users?search=kamau",
    ).expect(200);
    expect(searchResponse.body.data.users).toHaveLength(1);
    expect(searchResponse.body.data.users[0].id).toBe(firstSellerId);
  });

  it("updates user status and protects the current administrator", async () => {
    const disabled = await request(app)
      .patch(`/api/admin/users/${firstSellerId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "DISABLED" })
      .expect(200);

    expect(disabled.body.data.user).toMatchObject({
      id: firstSellerId,
      status: "DISABLED",
    });
    expect((await users.findById(firstSellerId))?.isActive).toBe(false);

    const selfDisable = await request(app)
      .patch(`/api/admin/users/${adminId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "DISABLED" })
      .expect(403);
    expect(selfDisable.body.message).toBe(
      "Administrators cannot disable their own account.",
    );

    await request(app)
      .patch(`/api/admin/users/${randomUUID()}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "ACTIVE" })
      .expect(404);
  });

  it("rejects login, refresh, and existing access tokens after disabling a user", async () => {
    const registration = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Disabled Customer",
        email: "disabled@example.com",
        password: "StrongPass1",
      })
      .expect(201);
    const userId = registration.body.data.user.id as string;
    const accessToken = registration.body.data.accessToken as string;
    const refreshCookie = cookiePair(readRefreshCookie(registration));

    await request(app)
      .patch(`/api/admin/users/${userId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "DISABLED" })
      .expect(200);

    await request(app)
      .post("/api/auth/login")
      .send({
        email: "disabled@example.com",
        password: "StrongPass1",
      })
      .expect(401);

    await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", refreshCookie)
      .send({})
      .expect(401);

    const profileResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(401);
    expect(profileResponse.body.message).toBe(
      "The authenticated account is unavailable or disabled.",
    );

    await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Rejected Category" })
      .expect(401);

    await request(app)
      .patch(`/api/admin/users/${userId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "ACTIVE" })
      .expect(200);

    await request(app)
      .post("/api/auth/login")
      .send({
        email: "disabled@example.com",
        password: "StrongPass1",
      })
      .expect(200);
  });

  it("lists sellers with product, order, and delivered revenue totals", async () => {
    const response = await adminGet(
      "/api/admin/sellers?search=kamau",
    ).expect(200);

    expect(response.body.data).toMatchObject({
      sellers: [
        {
          id: firstSellerId,
          shopName: "Kamau Materials",
          productCount: 2,
          orderCount: 3,
          revenue: "800.00",
          status: "ACTIVE",
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    });
  });

  it("filters products and enforces administrative deletion constraints", async () => {
    const response = await adminGet(
      `/api/admin/products?categoryId=${cementCategoryId}` +
        `&sellerId=${firstSellerId}&search=bulk`,
    ).expect(200);

    expect(response.body.data.products).toHaveLength(1);
    expect(response.body.data.products[0]).toMatchObject({
      id: cementProductId,
      seller: {
        id: firstSellerId,
        shopName: "Kamau Materials",
      },
      category: {
        id: cementCategoryId,
        name: "Cement",
      },
    });

    await request(app)
      .delete(`/api/admin/products/${removableProductId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    const conflict = await request(app)
      .delete(`/api/admin/products/${cementProductId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({})
      .expect(409);
    expect(conflict.body.message).toBe(
      "The product cannot be removed because it is referenced by an order.",
    );

    await request(app)
      .delete(`/api/admin/products/${randomUUID()}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({})
      .expect(404);
  });

  it("requires an active administrator for every admin endpoint", async () => {
    const endpoints = [
      "/api/admin/dashboard",
      "/api/admin/users",
      "/api/admin/sellers",
      "/api/admin/products",
    ];

    for (const endpoint of endpoints) {
      await request(app).get(endpoint).expect(401);
      await request(app)
        .get(endpoint)
        .set("Authorization", `Bearer ${customerToken}`)
        .expect(403);
    }

    users.setActive(adminId, false);
    for (const endpoint of endpoints) {
      await request(app)
        .get(endpoint)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(401);
    }
  });

  it("rejects invalid admin parameters, filters, and status values", async () => {
    await adminGet("/api/admin/users?page=0").expect(400);
    await adminGet("/api/admin/users?limit=101").expect(400);
    await adminGet("/api/admin/users?role=OWNER").expect(400);
    await adminGet("/api/admin/users?unknown=value").expect(400);
    await adminGet("/api/admin/products?categoryId=invalid").expect(400);

    await request(app)
      .patch(`/api/admin/users/${customerId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "SUSPENDED" })
      .expect(400);

    await request(app)
      .delete("/api/admin/products/not-a-uuid")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({})
      .expect(400);
  });

  function adminGet(path: string) {
    return request(app)
      .get(path)
      .set("Authorization", `Bearer ${adminToken}`);
  }

  function seedUsers(): void {
    users.addUser({
      id: adminId,
      name: "System Administrator",
      email: "admin@example.com",
      role: "ADMIN",
      createdAt: new Date("2026-01-10T08:00:00.000Z"),
    });
    users.addUser({
      id: customerId,
      name: "Alice Builder",
      email: "alice@example.com",
      company: "Alice Construction",
      role: "CUSTOMER",
      createdAt: new Date("2026-02-10T08:00:00.000Z"),
    });
    users.addUser({
      id: firstSellerId,
      name: "Amina Kamau",
      email: "amina@kamau.example.com",
      company: "Kamau Supplies",
      role: "SELLER",
      createdAt: new Date("2026-03-10T08:00:00.000Z"),
    });
    users.addUser({
      id: secondSellerId,
      name: "Brian Otieno",
      email: "brian@example.com",
      company: "Otieno Builders Hub",
      role: "SELLER",
      createdAt: new Date("2026-04-10T08:00:00.000Z"),
    });
  }

  function seedMarketplace(): void {
    dashboard.addSellerProfile({
      userId: firstSellerId,
      shopName: "Kamau Materials",
      phone: "+254700000001",
      address: "Nairobi",
    });
    dashboard.addSellerProfile({
      userId: secondSellerId,
      shopName: "Otieno Depot",
      phone: "+254700000002",
      address: "Kisumu",
    });
    dashboard.addCategory({ id: cementCategoryId, name: "Cement" });
    dashboard.addCategory({ id: steelCategoryId, name: "Steel" });

    dashboard.addProduct({
      id: cementProductId,
      sellerId: firstSellerId,
      categoryId: cementCategoryId,
      name: "Bulk Cement",
      description: "High-strength bagged cement",
      price: "100.00",
      quantity: 20,
      createdAt: new Date("2026-07-17T08:00:00.000Z"),
    });
    dashboard.addProduct({
      id: steelProductId,
      sellerId: firstSellerId,
      categoryId: steelCategoryId,
      name: "Steel Bar",
      price: "200.00",
      quantity: 10,
      createdAt: new Date("2026-07-16T08:00:00.000Z"),
    });
    dashboard.addProduct({
      id: aggregateProductId,
      sellerId: secondSellerId,
      categoryId: cementCategoryId,
      name: "Cement Additive",
      price: "50.00",
      quantity: 15,
      createdAt: new Date("2026-07-15T08:00:00.000Z"),
    });
    dashboard.addProduct({
      id: removableProductId,
      sellerId: secondSellerId,
      categoryId: steelCategoryId,
      name: "Unused Steel Mesh",
      price: "75.00",
      quantity: 5,
      createdAt: new Date("2026-07-14T08:00:00.000Z"),
    });

    dashboard.addOrder({
      id: "00000000-0000-4000-8000-000000000301",
      customerId,
      status: "DELIVERED",
      items: [
        { productId: cementProductId, quantity: 2, price: "100.00" },
        { productId: aggregateProductId, quantity: 1, price: "50.00" },
      ],
      createdAt: new Date("2026-07-18T08:00:00.000Z"),
    });
    dashboard.addOrder({
      id: "00000000-0000-4000-8000-000000000302",
      customerId,
      status: "DELIVERED",
      items: [
        { productId: steelProductId, quantity: 3, price: "200.00" },
      ],
      createdAt: new Date("2026-06-18T08:00:00.000Z"),
    });
    dashboard.addOrder({
      id: "00000000-0000-4000-8000-000000000303",
      customerId,
      status: "PENDING",
      items: [
        { productId: cementProductId, quantity: 1, price: "100.00" },
      ],
      createdAt: new Date("2026-07-19T08:00:00.000Z"),
    });
  }
});

function readRefreshCookie(response: Response): string {
  const setCookie = response.headers["set-cookie"] as unknown;
  const cookies = Array.isArray(setCookie)
    ? (setCookie as string[])
    : typeof setCookie === "string"
      ? [setCookie]
      : [];
  const refreshCookie = cookies.find((cookie) =>
    cookie.startsWith("refreshToken="),
  );

  if (!refreshCookie) {
    throw new Error("Response did not include a refresh token cookie.");
  }
  return refreshCookie;
}

function cookiePair(setCookie: string): string {
  return setCookie.split(";", 1)[0] ?? "";
}
