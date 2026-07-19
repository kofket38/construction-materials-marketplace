import { randomUUID } from "node:crypto";
import pino from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { JwtTokenService } from "../src/services/token.service.js";
import {
  InMemorySellerDashboardRepository,
  type SellerDashboardOrderSeed,
} from "./helpers/in-memory-seller-dashboard.repository.js";
import { InMemoryUserRepository } from "./helpers/in-memory-user.repository.js";

const sellerId = randomUUID();
const otherSellerId = randomUUID();
const firstCustomerId = randomUUID();
const secondCustomerId = randomUUID();
const cementCategoryId = randomUUID();
const steelCategoryId = randomUUID();
const roofingCategoryId = randomUUID();
const cementProductId = randomUUID();
const steelProductId = randomUUID();
const tileProductId = randomUUID();
const otherSellerProductId = randomUUID();

describe("Seller Dashboard API", () => {
  const tokenService = new JwtTokenService();
  let dashboard: InMemorySellerDashboardRepository;
  let app: ReturnType<typeof createApp>;
  let sellerToken: string;
  let customerToken: string;
  let adminToken: string;
  let dates: ReturnType<typeof createTestDates>;

  beforeEach(() => {
    dashboard = new InMemorySellerDashboardRepository();
    dates = createTestDates();
    seedProducts();
    seedOrders();

    app = createApp({
      userRepository: new InMemoryUserRepository(),
      sellerDashboardRepository: dashboard,
      tokenService,
      logger: pino({ level: "silent" }),
    });

    sellerToken = tokenService.createAccessToken({
      userId: sellerId,
      role: "SELLER",
    });
    customerToken = tokenService.createAccessToken({
      userId: firstCustomerId,
      role: "CUSTOMER",
    });
    adminToken = tokenService.createAccessToken({
      userId: randomUUID(),
      role: "ADMIN",
    });
  });

  it("returns the seller dashboard summary and latest seller orders", async () => {
    const response = await sellerGet("/api/seller/dashboard").expect(200);

    expect(response.body.data.dashboard).toMatchObject({
      totalProducts: 3,
      activeProducts: 2,
      totalOrders: 5,
      pendingOrders: 1,
      completedOrders: 2,
      cancelledOrders: 1,
      totalRevenue: "700.00",
      monthlyRevenue: "200.00",
    });
    expect(response.body.data.dashboard.recentOrders).toHaveLength(5);

    const sharedOrder = response.body.data.dashboard.recentOrders.find(
      (order: { id: string }) => order.id === "00000000-0000-4000-8000-000000000101",
    );
    expect(sharedOrder).toMatchObject({
      sellerTotal: "200.00",
      totalItems: 2,
      items: [{ productId: cementProductId }],
    });
  });

  it("lists only the seller's products with pagination and filters", async () => {
    const filtered = await sellerGet(
      `/api/seller/products?categoryId=${roofingCategoryId}` +
        "&stock=low_stock&search=tile&sortBy=price&sortOrder=asc" +
        "&page=1&limit=1",
    ).expect(200);

    expect(filtered.body.data).toMatchObject({
      products: [
        {
          id: tileProductId,
          sellerId,
          categoryId: roofingCategoryId,
          quantity: 5,
        },
      ],
      pagination: {
        page: 1,
        limit: 1,
        total: 1,
        totalPages: 1,
      },
    });

    const paginated = await sellerGet(
      "/api/seller/products?sortBy=name&sortOrder=asc&page=1&limit=2",
    ).expect(200);

    expect(
      paginated.body.data.products.map(
        (product: { name: string }) => product.name,
      ),
    ).toEqual(["Premium Cement", "Roof Tile"]);
    expect(paginated.body.data.pagination).toEqual({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
  });

  it("lists seller orders with status, date, customer, and pagination filters", async () => {
    const response = await sellerGet(
      "/api/seller/orders?status=DELIVERED" +
        `&dateFrom=${formatDate(dates.previousMonth)}` +
        `&dateTo=${formatDate(dates.previousMonth)}` +
        "&customerSearch=alice&page=1&limit=1",
    ).expect(200);

    expect(response.body.data).toMatchObject({
      orders: [
        {
          id: "00000000-0000-4000-8000-000000000103",
          customer: {
            id: firstCustomerId,
            name: "Alice Builder",
          },
          status: "DELIVERED",
          sellerTotal: "500.00",
          totalItems: 4,
        },
      ],
      pagination: {
        page: 1,
        limit: 1,
        total: 1,
        totalPages: 1,
      },
    });
    expect(response.body.data.orders[0].items).toHaveLength(2);
  });

  it("returns seller analytics without other sellers' sales", async () => {
    const response = await sellerGet("/api/seller/analytics").expect(200);
    const analytics = response.body.data.analytics;

    expect(analytics.bestSellingProducts).toEqual([
      {
        productId: tileProductId,
        name: "Roof Tile",
        unitsSold: 4,
        revenue: "200.00",
      },
      {
        productId: cementProductId,
        name: "Premium Cement",
        unitsSold: 3,
        revenue: "300.00",
      },
      {
        productId: steelProductId,
        name: "Steel Bar",
        unitsSold: 1,
        revenue: "200.00",
      },
    ]);
    expect(analytics.monthlySales).toEqual([
      {
        month: monthKey(dates.previousMonth),
        orders: 1,
        unitsSold: 4,
      },
      {
        month: monthKey(dates.currentMonthDelivered),
        orders: 1,
        unitsSold: 4,
      },
    ]);
    expect(analytics.revenueByMonth).toEqual([
      {
        month: monthKey(dates.previousMonth),
        revenue: "500.00",
      },
      {
        month: monthKey(dates.currentMonthDelivered),
        revenue: "200.00",
      },
    ]);
    expect(analytics.ordersByStatus).toEqual([
      { status: "PENDING", count: 1 },
      { status: "CONFIRMED", count: 1 },
      { status: "SHIPPED", count: 0 },
      { status: "DELIVERED", count: 2 },
      { status: "CANCELLED", count: 1 },
    ]);
    expect(analytics.topCategories).toEqual([
      {
        categoryId: cementCategoryId,
        name: "Cement",
        unitsSold: 3,
        revenue: "300.00",
      },
      {
        categoryId: roofingCategoryId,
        name: "Roofing",
        unitsSold: 4,
        revenue: "200.00",
      },
      {
        categoryId: steelCategoryId,
        name: "Steel",
        unitsSold: 1,
        revenue: "200.00",
      },
    ]);
  });

  it("requires authentication for every seller dashboard endpoint", async () => {
    for (const endpoint of sellerEndpoints) {
      await request(app).get(endpoint).expect(401);
    }
  });

  it("denies customer access to every seller dashboard endpoint", async () => {
    for (const endpoint of sellerEndpoints) {
      await request(app)
        .get(endpoint)
        .set("Authorization", `Bearer ${customerToken}`)
        .expect(403);
    }
  });

  it("denies admin access because the module is seller-only", async () => {
    for (const endpoint of sellerEndpoints) {
      await request(app)
        .get(endpoint)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(403);
    }
  });

  it("rejects invalid pagination, sorting, stock, and date filters", async () => {
    await sellerGet("/api/seller/products?page=0").expect(400);
    await sellerGet("/api/seller/products?limit=101").expect(400);
    await sellerGet("/api/seller/products?sortBy=invalid").expect(400);
    await sellerGet("/api/seller/products?stock=all").expect(400);
    await sellerGet("/api/seller/orders?dateFrom=2026-02-30").expect(400);
    await sellerGet(
      "/api/seller/orders?dateFrom=2026-07-10&dateTo=2026-07-01",
    ).expect(400);
  });

  function sellerGet(path: string) {
    return request(app)
      .get(path)
      .set("Authorization", `Bearer ${sellerToken}`);
  }

  function seedProducts(): void {
    dashboard.addProduct({
      id: cementProductId,
      sellerId,
      sellerName: "Seller One",
      categoryId: cementCategoryId,
      categoryName: "Cement",
      name: "Premium Cement",
      price: "100.00",
      quantity: 25,
      createdAt: dates.productNewest,
    });
    dashboard.addProduct({
      id: steelProductId,
      sellerId,
      sellerName: "Seller One",
      categoryId: steelCategoryId,
      categoryName: "Steel",
      name: "Steel Bar",
      price: "200.00",
      quantity: 0,
      createdAt: dates.productMiddle,
    });
    dashboard.addProduct({
      id: tileProductId,
      sellerId,
      sellerName: "Seller One",
      categoryId: roofingCategoryId,
      categoryName: "Roofing",
      name: "Roof Tile",
      price: "50.00",
      quantity: 5,
      createdAt: dates.productOldest,
    });
    dashboard.addProduct({
      id: otherSellerProductId,
      sellerId: otherSellerId,
      sellerName: "Seller Two",
      categoryId: cementCategoryId,
      categoryName: "Cement",
      name: "Other Seller Sand",
      price: "20.00",
      quantity: 100,
      createdAt: dates.productNewest,
    });
  }

  function seedOrders(): void {
    addOrder({
      id: "00000000-0000-4000-8000-000000000101",
      customer: firstCustomer,
      status: "PENDING",
      createdAt: dates.currentMonthPending,
      items: [
        { productId: cementProductId, quantity: 2, price: "100.00" },
        { productId: otherSellerProductId, quantity: 10, price: "20.00" },
      ],
    });
    addOrder({
      id: "00000000-0000-4000-8000-000000000102",
      customer: secondCustomer,
      status: "DELIVERED",
      createdAt: dates.currentMonthDelivered,
      items: [{ productId: tileProductId, quantity: 4, price: "50.00" }],
    });
    addOrder({
      id: "00000000-0000-4000-8000-000000000103",
      customer: firstCustomer,
      status: "DELIVERED",
      createdAt: dates.previousMonth,
      items: [
        { productId: cementProductId, quantity: 3, price: "100.00" },
        { productId: steelProductId, quantity: 1, price: "200.00" },
      ],
    });
    addOrder({
      id: "00000000-0000-4000-8000-000000000104",
      customer: secondCustomer,
      status: "CANCELLED",
      createdAt: dates.twoMonthsAgo,
      items: [{ productId: cementProductId, quantity: 1, price: "100.00" }],
    });
    addOrder({
      id: "00000000-0000-4000-8000-000000000105",
      customer: firstCustomer,
      status: "CONFIRMED",
      createdAt: dates.currentMonthConfirmed,
      items: [{ productId: steelProductId, quantity: 2, price: "200.00" }],
    });
    addOrder({
      id: "00000000-0000-4000-8000-000000000106",
      customer: secondCustomer,
      status: "DELIVERED",
      createdAt: dates.currentMonthDelivered,
      items: [
        { productId: otherSellerProductId, quantity: 5, price: "20.00" },
      ],
    });
  }

  function addOrder(
    seed: Omit<SellerDashboardOrderSeed, "updatedAt">,
  ): void {
    dashboard.addOrder(seed);
  }
});

const sellerEndpoints = [
  "/api/seller/dashboard",
  "/api/seller/products",
  "/api/seller/orders",
  "/api/seller/analytics",
];

const firstCustomer = {
  id: firstCustomerId,
  name: "Alice Builder",
  email: "alice@example.com",
};

const secondCustomer = {
  id: secondCustomerId,
  name: "Brian Contractor",
  email: "brian@example.com",
};

function createTestDates() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  return {
    currentMonthPending: new Date(Date.UTC(year, month, 12, 12)),
    currentMonthConfirmed: new Date(Date.UTC(year, month, 10, 12)),
    currentMonthDelivered: new Date(Date.UTC(year, month, 8, 12)),
    previousMonth: new Date(Date.UTC(year, month - 1, 15, 12)),
    twoMonthsAgo: new Date(Date.UTC(year, month - 2, 15, 12)),
    productNewest: new Date(Date.UTC(year, month, 3, 12)),
    productMiddle: new Date(Date.UTC(year, month, 2, 12)),
    productOldest: new Date(Date.UTC(year, month, 1, 12)),
  };
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}
