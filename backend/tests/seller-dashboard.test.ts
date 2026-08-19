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
  let users: InMemoryUserRepository;
  let app: ReturnType<typeof createApp>;
  let sellerToken: string;
  let otherSellerToken: string;
  let customerToken: string;
  let adminToken: string;
  let dates: ReturnType<typeof createTestDates>;

  beforeEach(() => {
    dashboard = new InMemorySellerDashboardRepository();
    dates = createTestDates();
    seedProducts();
    seedOrders();

    users = new InMemoryUserRepository();
    const adminId = randomUUID();
    users.addUser({ id: sellerId, role: "SELLER" });
    users.addUser({ id: otherSellerId, role: "SELLER" });
    users.addUser({ id: firstCustomerId, role: "CUSTOMER" });
    users.addUser({ id: adminId, role: "ADMIN" });

    app = createApp({
      userRepository: users,
      sellerDashboardRepository: dashboard,
      tokenService,
      logger: pino({ level: "silent" }),
    });

    sellerToken = tokenService.createAccessToken({
      userId: sellerId,
      role: "SELLER",
    });
    otherSellerToken = tokenService.createAccessToken({
      userId: otherSellerId,
      role: "SELLER",
    });
    customerToken = tokenService.createAccessToken({
      userId: firstCustomerId,
      role: "CUSTOMER",
    });
    adminToken = tokenService.createAccessToken({
      userId: adminId,
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
      inventorySummary: {
        totalProducts: 3,
        lowStock: 1,
        outOfStock: 1,
        inventoryValue: "2750.00",
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

  it("returns seller-owned order details and hides other sellers' orders", async () => {
    const response = await sellerGet(
      "/api/seller/orders/00000000-0000-4000-8000-000000000101",
    ).expect(200);

    expect(response.body.data.order).toMatchObject({
      id: "00000000-0000-4000-8000-000000000101",
      customer: {
        name: "Alice Builder",
      },
      paymentMethod: "CASH_ON_DELIVERY",
      shippingCity: "Addis Ababa",
      sellerTotal: "200.00",
      items: [{ productId: cementProductId }],
    });
    expect(response.body.data.order.items).toHaveLength(1);

    await sellerGet(
      "/api/seller/orders/00000000-0000-4000-8000-000000000106",
    ).expect(404);
  });

  it("allows the owning seller to approve or reject pending payment proof", async () => {
    const approvedOrderId = dashboard.addOrder({
      customer: firstCustomer,
      status: "PENDING_PAYMENT_VERIFICATION",
      paymentMethod: "CBE_BANK",
      payment: {
        proofImageUrl: "approved.png",
      },
      items: [
        { productId: cementProductId, quantity: 1, price: "100.00" },
      ],
    });
    dashboard.reserveOrderInventory(approvedOrderId);
    const rejectedOrderId = dashboard.addOrder({
      customer: secondCustomer,
      status: "PENDING_PAYMENT_VERIFICATION",
      paymentMethod: "TELEBIRR",
      payment: {
        method: "TELEBIRR",
        proofImageUrl: "rejected.png",
      },
      items: [{ productId: tileProductId, quantity: 2, price: "50.00" }],
    });
    dashboard.reserveOrderInventory(rejectedOrderId);
    expect(dashboard.getProductQuantity(tileProductId)).toBe(3);

    const approved = await request(app)
      .patch(`/api/seller/orders/${approvedOrderId}/payment`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ decision: "APPROVE" })
      .expect(200);
    expect(approved.body.data.order).toMatchObject({
      status: "CONFIRMED",
      payment: {
        status: "VERIFIED",
      },
    });

    const rejected = await request(app)
      .patch(`/api/seller/orders/${rejectedOrderId}/payment`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ decision: "REJECT" })
      .expect(200);
    expect(rejected.body.data.order).toMatchObject({
      status: "PAYMENT_REJECTED",
      payment: {
        status: "REJECTED",
      },
    });
    expect(dashboard.getProductQuantity(tileProductId)).toBe(5);
    expect(dashboard.getInventoryTransactionCount(rejectedOrderId)).toBe(2);

    await request(app)
      .patch(`/api/seller/orders/${approvedOrderId}/payment`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ decision: "APPROVE" })
      .expect(409);
  });

  it("requires a payment decision while proof verification is pending", async () => {
    const orderId = dashboard.addOrder({
      customer: firstCustomer,
      status: "PENDING_PAYMENT_VERIFICATION",
      paymentMethod: "CBE_BANK",
      payment: {
        proofImageUrl: "pending.png",
      },
      items: [
        { productId: cementProductId, quantity: 1, price: "100.00" },
      ],
    });

    await updateSellerOrderStatus(orderId, "CANCELLED").expect(409);

    const order = await dashboard.findOrderById(sellerId, orderId);
    expect(order).toMatchObject({
      status: "PENDING_PAYMENT_VERIFICATION",
      payment: { status: "PENDING_VERIFICATION" },
    });
  });

  it("enforces the seller fulfillment sequence", async () => {
    const orderId = dashboard.addOrder({
      customer: firstCustomer,
      status: "PENDING_CONFIRMATION",
      items: [
        { productId: cementProductId, quantity: 1, price: "100.00" },
      ],
    });

    await request(app)
      .patch(`/api/seller/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ status: "READY_FOR_DELIVERY" })
      .expect(409);

    for (const status of [
      "CONFIRMED",
      "PROCESSING",
      "READY_FOR_DELIVERY",
      "SHIPPED",
      "DELIVERED",
    ] as const) {
      const response = await updateSellerOrderStatus(
        orderId,
        status,
      ).expect(200);
      expect(response.body.data.order.status).toBe(status);
    }

    await updateSellerOrderStatus(orderId, "DELIVERED").expect(409);
  });

  it("keeps reserved inventory unchanged through seller fulfillment", async () => {
    const orderId = dashboard.addOrder({
      customer: firstCustomer,
      status: "PROCESSING",
      items: [
        { productId: cementProductId, quantity: 2, price: "100.00" },
      ],
    });

    dashboard.reserveOrderInventory(orderId);
    expect(dashboard.getProductQuantity(cementProductId)).toBe(23);

    await updateSellerOrderStatus(
      orderId,
      "READY_FOR_DELIVERY",
    ).expect(200);
    await updateSellerOrderStatus(orderId, "SHIPPED").expect(200);

    expect(dashboard.getProductQuantity(cementProductId)).toBe(23);
    expect(dashboard.getInventoryTransactionCount(orderId)).toBe(1);

    await updateSellerOrderStatus(orderId, "SHIPPED").expect(409);

    expect(dashboard.getProductQuantity(cementProductId)).toBe(23);
    expect(dashboard.getInventoryTransactionCount(orderId)).toBe(1);
  });

  it("allows cancellation before shipment and rejects it after shipment", async () => {
    const cancellableOrderId = dashboard.addOrder({
      customer: firstCustomer,
      status: "CONFIRMED",
      items: [
        { productId: cementProductId, quantity: 1, price: "100.00" },
      ],
    });
    dashboard.reserveOrderInventory(cancellableOrderId);
    const shippedOrderId = dashboard.addOrder({
      customer: secondCustomer,
      status: "SHIPPED",
      items: [{ productId: tileProductId, quantity: 1, price: "50.00" }],
    });

    const cancelled = await updateSellerOrderStatus(
      cancellableOrderId,
      "CANCELLED",
    ).expect(200);
    expect(cancelled.body.data.order.status).toBe("CANCELLED");
    expect(dashboard.getProductQuantity(cementProductId)).toBe(25);
    expect(dashboard.getInventoryTransactionCount(cancellableOrderId)).toBe(2);

    await updateSellerOrderStatus(shippedOrderId, "CANCELLED").expect(
      409,
    );
  });

  it("prevents another seller from viewing or mutating the order", async () => {
    const orderId = dashboard.addOrder({
      customer: firstCustomer,
      status: "PENDING_PAYMENT_VERIFICATION",
      paymentMethod: "CBE_BANK",
      payment: {
        proofImageUrl: "private.png",
      },
      items: [
        { productId: cementProductId, quantity: 1, price: "100.00" },
      ],
    });

    await request(app)
      .get(`/api/seller/orders/${orderId}`)
      .set("Authorization", `Bearer ${otherSellerToken}`)
      .expect(404);
    await request(app)
      .patch(`/api/seller/orders/${orderId}/payment`)
      .set("Authorization", `Bearer ${otherSellerToken}`)
      .send({ decision: "APPROVE" })
      .expect(404);
    await request(app)
      .patch(`/api/seller/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${otherSellerToken}`)
      .send({ status: "PROCESSING" })
      .expect(404);
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
      { status: "COMPLETED", count: 0 },
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

  // ── Stock filter uses SellerInventory.quantity ─────────────────────────────

  it("stock=out_of_stock includes products with SellerInventory.quantity=0 even when Product.quantity=100", async () => {
    const isolatedDashboard = new InMemorySellerDashboardRepository();
    const isolatedUsers = new InMemoryUserRepository();
    const isolatedSellerId = randomUUID();
    isolatedUsers.addUser({ id: isolatedSellerId, role: "SELLER" });
    const catId = randomUUID();
    const outOfStockProductId = randomUUID();
    const inStockProductId = randomUUID();

    // Product.quantity=100 but SellerInventory.quantity=0 → should show as out_of_stock
    isolatedDashboard.addProduct({
      id: outOfStockProductId,
      sellerId: isolatedSellerId,
      categoryId: catId,
      categoryName: "Cement",
      name: "Misleading Legacy Stock",
      price: "100.00",
      quantity: 100,         // legacy — must NOT drive stock filter
      inventoryQuantity: 0,  // authoritative → out of stock
    });
    // Product.quantity=0 but SellerInventory.quantity=100 → must NOT show as out_of_stock
    isolatedDashboard.addProduct({
      id: inStockProductId,
      sellerId: isolatedSellerId,
      categoryId: catId,
      categoryName: "Cement",
      name: "Correct Inventory Stock",
      price: "100.00",
      quantity: 0,             // legacy — must NOT drive stock filter
      inventoryQuantity: 100,  // authoritative → in stock
    });

    const isolatedApp = createApp({
      userRepository: isolatedUsers,
      sellerDashboardRepository: isolatedDashboard,
      tokenService,
      logger: pino({ level: "silent" }),
    });
    const token = tokenService.createAccessToken({
      userId: isolatedSellerId,
      role: "SELLER",
    });

    const res = await request(isolatedApp)
      .get("/api/seller/products?stock=out_of_stock")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const ids = res.body.data.products.map((p: { id: string }) => p.id);
    // outOfStockProductId must appear (SellerInventory.quantity=0)
    expect(ids).toContain(outOfStockProductId);
    // inStockProductId must NOT appear (SellerInventory.quantity=100 → in stock)
    expect(ids).not.toContain(inStockProductId);
  });

  it("stock=in_stock excludes products where SellerInventory.quantity=0 even when Product.quantity=999", async () => {
    const isolatedDashboard = new InMemorySellerDashboardRepository();
    const isolatedUsers = new InMemoryUserRepository();
    const isolatedSellerId = randomUUID();
    isolatedUsers.addUser({ id: isolatedSellerId, role: "SELLER" });
    const catId = randomUUID();
    const ghostProductId = randomUUID();

    // Product.quantity=999 but SellerInventory.quantity=0 → must NOT appear as in_stock
    isolatedDashboard.addProduct({
      id: ghostProductId,
      sellerId: isolatedSellerId,
      categoryId: catId,
      categoryName: "Cement",
      name: "Ghost Stock",
      price: "100.00",
      quantity: 999,
      inventoryQuantity: 0,
    });

    const isolatedApp = createApp({
      userRepository: isolatedUsers,
      sellerDashboardRepository: isolatedDashboard,
      tokenService,
      logger: pino({ level: "silent" }),
    });
    const token = tokenService.createAccessToken({
      userId: isolatedSellerId,
      role: "SELLER",
    });

    const res = await request(isolatedApp)
      .get("/api/seller/products?stock=in_stock")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const ids = res.body.data.products.map((p: { id: string }) => p.id);
    expect(ids).not.toContain(ghostProductId);
    expect(res.body.data.pagination.total).toBe(0);
  });

  // ── Quantity sort uses SellerInventory.quantity ────────────────────────────

  it("sortBy=quantity orders by SellerInventory.quantity regardless of Product.quantity", async () => {
    const isolatedDashboard = new InMemorySellerDashboardRepository();
    const isolatedUsers = new InMemoryUserRepository();
    const isolatedSellerId = randomUUID();
    isolatedUsers.addUser({ id: isolatedSellerId, role: "SELLER" });
    const catId = randomUUID();

    const productAId = randomUUID();
    const productBId = randomUUID();
    const productCId = randomUUID();

    // Product.quantity order: A=5, B=20, C=1 → ascending Product order: C,A,B
    // SellerInventory.quantity order: A=100, B=5, C=50 → ascending Inventory order: B,C,A
    // The test verifies the result matches SellerInventory order (B,C,A), not Product order.
    isolatedDashboard.addProduct({
      id: productAId,
      sellerId: isolatedSellerId,
      categoryId: catId,
      categoryName: "Cement",
      name: "Product A",
      price: "100.00",
      quantity: 5,            // legacy
      inventoryQuantity: 100, // authoritative
    });
    isolatedDashboard.addProduct({
      id: productBId,
      sellerId: isolatedSellerId,
      categoryId: catId,
      categoryName: "Cement",
      name: "Product B",
      price: "100.00",
      quantity: 20,           // legacy
      inventoryQuantity: 5,   // authoritative — lowest
    });
    isolatedDashboard.addProduct({
      id: productCId,
      sellerId: isolatedSellerId,
      categoryId: catId,
      categoryName: "Cement",
      name: "Product C",
      price: "100.00",
      quantity: 1,            // legacy
      inventoryQuantity: 50,  // authoritative — middle
    });

    const isolatedApp = createApp({
      userRepository: isolatedUsers,
      sellerDashboardRepository: isolatedDashboard,
      tokenService,
      logger: pino({ level: "silent" }),
    });
    const token = tokenService.createAccessToken({
      userId: isolatedSellerId,
      role: "SELLER",
    });

    // ASC: SellerInventory.quantity 5→50→100 = B,C,A
    const ascRes = await request(isolatedApp)
      .get("/api/seller/products?sortBy=quantity&sortOrder=asc")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const ascIds = ascRes.body.data.products.map((p: { id: string }) => p.id);
    expect(ascIds).toEqual([productBId, productCId, productAId]);

    // DESC: SellerInventory.quantity 100→50→5 = A,C,B
    const descRes = await request(isolatedApp)
      .get("/api/seller/products?sortBy=quantity&sortOrder=desc")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const descIds = descRes.body.data.products.map((p: { id: string }) => p.id);
    expect(descIds).toEqual([productAId, productCId, productBId]);
  });

  // ── Price validation: zero is rejected ────────────────────────────────────
  // (Tested via the seller-inventory.test.ts; documented here for traceability)
  // The validator is tested directly in seller-inventory.test.ts.

  // ── Inventory source-of-truth regression tests ─────────────────────────────

  it("dashboard activeProducts reflects SellerInventory.quantity, not Product.quantity", async () => {
    // Clear existing products so we have full control over quantities.
    const isolatedDashboard = new InMemorySellerDashboardRepository();
    const isolatedUsers = new InMemoryUserRepository();
    const isolatedSellerId = randomUUID();
    isolatedUsers.addUser({ id: isolatedSellerId, role: "SELLER" });

    // Product.quantity = 100 (misleading legacy value)
    // SellerInventory.quantity = 0 (authoritative — this is what matters)
    const catId = randomUUID();
    isolatedDashboard.addProduct({
      id: randomUUID(),
      sellerId: isolatedSellerId,
      categoryId: catId,
      categoryName: "Cement",
      name: "Product A",
      price: "100.00",
      quantity: 100,          // legacy Product.quantity — should NOT be used
      inventoryQuantity: 0,   // SellerInventory.quantity — must be used
    });
    // Product.quantity = 0, SellerInventory.quantity = 50 → counts as active
    isolatedDashboard.addProduct({
      id: randomUUID(),
      sellerId: isolatedSellerId,
      categoryId: catId,
      categoryName: "Cement",
      name: "Product B",
      price: "200.00",
      quantity: 0,            // legacy Product.quantity — should NOT be used
      inventoryQuantity: 50,  // SellerInventory.quantity — must be used
    });

    const isolatedApp = createApp({
      userRepository: isolatedUsers,
      sellerDashboardRepository: isolatedDashboard,
      tokenService,
      logger: pino({ level: "silent" }),
    });
    const token = tokenService.createAccessToken({
      userId: isolatedSellerId,
      role: "SELLER",
    });

    const res = await request(isolatedApp)
      .get("/api/seller/dashboard")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const { totalProducts, activeProducts } = res.body.data.dashboard;
    // Total products = 2 (both exist in catalog)
    expect(totalProducts).toBe(2);
    // Active = 1: only Product B has SellerInventory.quantity > 0
    // Would be 2 if it read Product.quantity (both were 100 and 50 from legacy)
    // Would be 1 if it read Product.quantity wrong direction (0 and 0)
    expect(activeProducts).toBe(1);
  });

  it("findProducts inventorySummary uses SellerInventory values, not Product values", async () => {
    const isolatedDashboard = new InMemorySellerDashboardRepository();
    const isolatedUsers = new InMemoryUserRepository();
    const isolatedSellerId = randomUUID();
    isolatedUsers.addUser({ id: isolatedSellerId, role: "SELLER" });

    const catId = randomUUID();
    // Product.quantity = 100, Product.price = "999.00" — legacy, must NOT appear in summary
    // SellerInventory.quantity = 0,  SellerInventory.price = "50.00" → outOfStock
    isolatedDashboard.addProduct({
      id: randomUUID(),
      sellerId: isolatedSellerId,
      categoryId: catId,
      categoryName: "Cement",
      name: "Out of Stock Product",
      price: "999.00",
      quantity: 100,
      inventoryQuantity: 0,
      inventoryPrice: "50.00",
    });
    // Product.quantity = 0 — legacy; SellerInventory.quantity = 5 → lowStock
    isolatedDashboard.addProduct({
      id: randomUUID(),
      sellerId: isolatedSellerId,
      categoryId: catId,
      categoryName: "Cement",
      name: "Low Stock Product",
      price: "999.00",
      quantity: 0,
      inventoryQuantity: 5,
      inventoryPrice: "200.00",
    });
    // SellerInventory.quantity = 50 → in stock; contributes 50 × 100.00 = 5000.00
    isolatedDashboard.addProduct({
      id: randomUUID(),
      sellerId: isolatedSellerId,
      categoryId: catId,
      categoryName: "Cement",
      name: "In Stock Product",
      price: "999.00",
      quantity: 999,
      inventoryQuantity: 50,
      inventoryPrice: "100.00",
    });

    const isolatedApp = createApp({
      userRepository: isolatedUsers,
      sellerDashboardRepository: isolatedDashboard,
      tokenService,
      logger: pino({ level: "silent" }),
    });
    const token = tokenService.createAccessToken({
      userId: isolatedSellerId,
      role: "SELLER",
    });

    const res = await request(isolatedApp)
      .get("/api/seller/products")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const { inventorySummary } = res.body.data;
    expect(inventorySummary.totalProducts).toBe(3);
    // outOfStock: 1 (SellerInventory.quantity = 0)
    expect(inventorySummary.outOfStock).toBe(1);
    // lowStock: 1 (SellerInventory.quantity = 5, 0 < qty <= 10)
    expect(inventorySummary.lowStock).toBe(1);
    // inventoryValue = 0×50 + 5×200 + 50×100 = 6000.00
    // If it used Product.price/quantity: 100×999 + 0×999 + 999×999 = huge wrong number
    expect(inventorySummary.inventoryValue).toBe("6000.00");
  });

  it("inventory summary is scoped to the requesting seller and excludes other sellers", async () => {
    const isolatedDashboard = new InMemorySellerDashboardRepository();
    const isolatedUsers = new InMemoryUserRepository();
    const sellerAId = randomUUID();
    const sellerBId = randomUUID();
    isolatedUsers.addUser({ id: sellerAId, role: "SELLER" });
    isolatedUsers.addUser({ id: sellerBId, role: "SELLER" });

    const catId = randomUUID();
    // Seller A: SellerInventory.quantity = 0 → outOfStock
    isolatedDashboard.addProduct({
      id: randomUUID(),
      sellerId: sellerAId,
      categoryId: catId,
      categoryName: "Cement",
      name: "Seller A Product",
      price: "100.00",
      quantity: 0,
      inventoryQuantity: 0,
      inventoryPrice: "100.00",
    });
    // Seller B: SellerInventory.quantity = 50, price = 200.00
    isolatedDashboard.addProduct({
      id: randomUUID(),
      sellerId: sellerBId,
      categoryId: catId,
      categoryName: "Cement",
      name: "Seller B Product",
      price: "200.00",
      quantity: 50,
      inventoryQuantity: 50,
      inventoryPrice: "200.00",
    });

    const isolatedApp = createApp({
      userRepository: isolatedUsers,
      sellerDashboardRepository: isolatedDashboard,
      tokenService,
      logger: pino({ level: "silent" }),
    });
    const tokenA = tokenService.createAccessToken({
      userId: sellerAId,
      role: "SELLER",
    });

    const res = await request(isolatedApp)
      .get("/api/seller/products")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);

    const { inventorySummary } = res.body.data;
    // Seller A sees only their own product (qty=0)
    expect(inventorySummary.totalProducts).toBe(1);
    expect(inventorySummary.outOfStock).toBe(1);
    expect(inventorySummary.lowStock).toBe(0);
    // Seller B's 50×200=10000 must NOT appear here
    expect(inventorySummary.inventoryValue).toBe("0.00");
  });

  function sellerGet(path: string) {
    return request(app)
      .get(path)
      .set("Authorization", `Bearer ${sellerToken}`);
  }

  function updateSellerOrderStatus(
    orderId: string,
    status:
      | "CONFIRMED"
      | "PROCESSING"
      | "READY_FOR_DELIVERY"
      | "SHIPPED"
      | "DELIVERED"
      | "CANCELLED",
  ) {
    return request(app)
      .patch(`/api/seller/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ status });
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
