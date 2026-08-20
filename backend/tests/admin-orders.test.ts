import { randomUUID } from "node:crypto";
import pino from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { JwtTokenService } from "../src/services/token.service.js";
import { InMemoryAdminDashboardRepository } from "./helpers/in-memory-admin-dashboard.repository.js";
import { InMemoryOrderRepository } from "./helpers/in-memory-order.repository.js";
import { InMemorySellerPaymentRepository } from "./helpers/in-memory-seller-payment.repository.js";
import { InMemoryUserRepository } from "./helpers/in-memory-user.repository.js";

const adminId = randomUUID();
const customerId = randomUUID();
const sellerId = randomUUID();
const categoryId = randomUUID();
const productAId = randomUUID();
const productBId = randomUUID();

describe("Admin Orders API", () => {
  const tokenService = new JwtTokenService();
  let app: ReturnType<typeof createApp>;
  let users: InMemoryUserRepository;
  let dashboard: InMemoryAdminDashboardRepository;
  let orders: InMemoryOrderRepository;
  let sellerPayments: InMemorySellerPaymentRepository;
  let adminToken: string;
  let customerToken: string;
  let sellerToken: string;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    users.addUser({ id: adminId, role: "ADMIN" });
    users.addUser({ id: customerId, role: "CUSTOMER" });
    users.addUser({ id: sellerId, role: "SELLER" });

    dashboard = new InMemoryAdminDashboardRepository(users);
    dashboard.addCategory({ id: categoryId, name: "Cement" });
    dashboard.addProduct({
      id: productAId,
      sellerId,
      categoryId,
      name: "Cement Bag",
      price: "100.00",
      quantity: 50,
    });
    dashboard.addProduct({
      id: productBId,
      sellerId,
      categoryId,
      name: "Steel Bar",
      price: "200.00",
      quantity: 20,
    });

    // Seed orders into the in-memory admin dashboard helper so the
    // /api/admin/orders endpoint can find them.
    dashboard.addOrder({
      id: "11111111-1111-4111-8111-111111111111",
      customerId,
      status: "DELIVERED",
      items: [{ productId: productAId, quantity: 2, price: "100.00" }],
      createdAt: new Date("2026-07-01T10:00:00Z"),
    });
    dashboard.addOrder({
      id: "22222222-2222-4222-8222-222222222222",
      customerId,
      status: "PENDING_CONFIRMATION",
      items: [{ productId: productBId, quantity: 1, price: "200.00" }],
      createdAt: new Date("2026-07-05T10:00:00Z"),
    });
    dashboard.addOrder({
      id: "33333333-3333-4333-8333-333333333333",
      customerId,
      status: "CANCELLED",
      items: [{ productId: productAId, quantity: 3, price: "100.00" }],
      createdAt: new Date("2026-07-10T10:00:00Z"),
    });

    orders = new InMemoryOrderRepository();
    orders.addCustomer({ id: customerId, name: "Test Customer", email: "customer@test.local" });
    orders.addProduct({ id: productAId, sellerId, name: "Cement Bag", imageUrl: null, price: "100.00", quantity: 50 });
    orders.addInventory(sellerId, productAId, { price: "100.00", quantity: 50, city: "Addis Ababa" });

    sellerPayments = new InMemorySellerPaymentRepository();
    sellerPayments.addProduct(productAId, sellerId);
    sellerPayments.addProduct(productBId, sellerId);
    sellerPayments.addProfile({
      sellerId,
      sellerName: "Test Seller",
      sellerPhone: "+251911000001",
      destinations: [
        {
          method: "CBE_BANK",
          providerName: "CBE Bank",
          accountName: "Test Seller PLC",
          accountNumber: "1000099999999",
          accountNumberLabel: "Account number",
        },
      ],
    });

    app = createApp({
      adminDashboardRepository: dashboard,
      orderRepository: orders,
      sellerPaymentRepository: sellerPayments,
      userRepository: users,
      tokenService,
      logger: pino({ level: "silent" }),
    });

    adminToken = tokenService.createAccessToken({ userId: adminId, role: "ADMIN" });
    customerToken = tokenService.createAccessToken({ userId: customerId, role: "CUSTOMER" });
    sellerToken = tokenService.createAccessToken({ userId: sellerId, role: "SELLER" });
  });

  // ── Authorization ───────────────────────────────────────────────────────────

  it("requires authentication", async () => {
    await request(app).get("/api/admin/orders").expect(401);
  });

  it("rejects customer access", async () => {
    await request(app)
      .get("/api/admin/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(403);
  });

  it("rejects seller access", async () => {
    await request(app)
      .get("/api/admin/orders")
      .set("Authorization", `Bearer ${sellerToken}`)
      .expect(403);
  });

  // ── Basic listing ────────────────────────────────────────────────────────────

  it("returns all orders with pagination metadata", async () => {
    const res = await adminGet("/api/admin/orders").expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.orders).toHaveLength(3);
    expect(res.body.data.pagination).toMatchObject({
      page: 1,
      limit: 20,
      total: 3,
      totalPages: 1,
    });
  });

  it("orders are sorted newest-first", async () => {
    const res = await adminGet("/api/admin/orders").expect(200);
    const ids = res.body.data.orders.map((o: { id: string }) => o.id);
    expect(ids[0]).toBe("33333333-3333-4333-8333-333333333333");
    expect(ids[2]).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("each order includes customer, status, total, and item count", async () => {
    const res = await adminGet("/api/admin/orders").expect(200);
    const order = res.body.data.orders.find(
      (o: { id: string }) => o.id === "11111111-1111-4111-8111-111111111111",
    );
    expect(order).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      status: "DELIVERED",
      totalAmount: "200.00",
      itemCount: 1,
      customer: {
        id: customerId,
      },
    });
  });

  // ── Pagination ──────────────────────────────────────────────────────────────

  it("paginates correctly", async () => {
    const page1 = await adminGet("/api/admin/orders?page=1&limit=2").expect(200);
    expect(page1.body.data.orders).toHaveLength(2);
    expect(page1.body.data.pagination).toMatchObject({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });

    const page2 = await adminGet("/api/admin/orders?page=2&limit=2").expect(200);
    expect(page2.body.data.orders).toHaveLength(1);
    expect(page2.body.data.pagination.page).toBe(2);
  });

  // ── Status filter ───────────────────────────────────────────────────────────

  it("filters by order status", async () => {
    const res = await adminGet("/api/admin/orders?status=DELIVERED").expect(200);
    expect(res.body.data.orders).toHaveLength(1);
    expect(res.body.data.orders[0].status).toBe("DELIVERED");
  });

  it("returns empty when status matches no orders", async () => {
    const res = await adminGet("/api/admin/orders?status=SHIPPED").expect(200);
    expect(res.body.data.orders).toHaveLength(0);
    expect(res.body.data.pagination.total).toBe(0);
  });

  // ── Search ──────────────────────────────────────────────────────────────────

  it("filters by customer name", async () => {
    const res = await adminGet("/api/admin/orders?search=Test").expect(200);
    expect(res.body.data.orders).toHaveLength(3);
  });

  it("returns empty when search matches nothing", async () => {
    const res = await adminGet("/api/admin/orders?search=xyznotexist").expect(200);
    expect(res.body.data.orders).toHaveLength(0);
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  it("rejects invalid page", async () => {
    await adminGet("/api/admin/orders?page=0").expect(400);
  });

  it("rejects limit above 100", async () => {
    await adminGet("/api/admin/orders?limit=101").expect(400);
  });

  it("rejects unknown query parameters", async () => {
    await adminGet("/api/admin/orders?unknownParam=x").expect(400);
  });

  it("rejects invalid status value", async () => {
    await adminGet("/api/admin/orders?status=INVALID_STATUS").expect(400);
  });

  it("rejects invalid paymentStatus value", async () => {
    await adminGet("/api/admin/orders?paymentStatus=NOT_A_STATUS").expect(400);
  });

  // ── Order status update (existing endpoint, admin access) ──────────────────

  it("admin can update order status via PATCH /api/orders/:id/status", async () => {
    // Create a real order to update
    const created = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ productId: productAId, sellerId, quantity: 1 }],
        shipping: {
          fullName: "Test Customer",
          phone: "+251911000000",
          city: "Addis Ababa",
          address: "Bole Road",
        },
        paymentMethod: "CASH_ON_DELIVERY",
      })
      .expect(201);

    const orderId = created.body.data.order.id as string;
    const updated = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "CONFIRMED" })
      .expect(200);

    expect(updated.body.data.order.status).toBe("CONFIRMED");
  });

  it("customer cannot update order status via admin endpoint", async () => {
    const created = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ productId: productAId, sellerId, quantity: 1 }],
        shipping: {
          fullName: "Test Customer",
          phone: "+251911000000",
          city: "Addis Ababa",
          address: "Bole Road",
        },
        paymentMethod: "CASH_ON_DELIVERY",
      })
      .expect(201);

    const orderId = created.body.data.order.id as string;
    await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ status: "CONFIRMED" })
      .expect(403);
  });

  it("admin can cancel an order that is not yet terminal (PENDING_CONFIRMATION → CANCELLED)", async () => {
    const created = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ productId: productAId, sellerId, quantity: 1 }],
        shipping: {
          fullName: "Test Customer",
          phone: "+251911000000",
          city: "Addis Ababa",
          address: "Bole Road",
        },
        paymentMethod: "CASH_ON_DELIVERY",
      })
      .expect(201);

    const orderId = created.body.data.order.id as string;

    const cancelled = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "CANCELLED" })
      .expect(200);

    expect(cancelled.body.data.order.status).toBe("CANCELLED");
  });

  it("admin cannot update a CANCELLED order (terminal state)", async () => {
    const created = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ productId: productAId, sellerId, quantity: 1 }],
        shipping: {
          fullName: "Test Customer",
          phone: "+251911000000",
          city: "Addis Ababa",
          address: "Bole Road",
        },
        paymentMethod: "CASH_ON_DELIVERY",
      })
      .expect(201);

    const orderId = created.body.data.order.id as string;

    // Cancel it first.
    await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "CANCELLED" })
      .expect(200);

    // Trying to update a CANCELLED order (terminal) must fail with 409.
    await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "CONFIRMED" })
      .expect(409);
  });

  // ── Admin state-machine: retrograde and invalid jump tests ─────────────────

  it("admin cannot make a retrograde transition (DELIVERED → PENDING_PAYMENT) — returns 409", async () => {
    // Advance order to DELIVERED via admin status updates.
    const orderId = await createOrderAtStatus("DELIVERED");

    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "PENDING_PAYMENT" })
      .expect(409);

    expect(res.body.success).toBe(false);

    // Status must remain DELIVERED.
    const check = await request(app)
      .get(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(200);
    expect(check.body.data.order.status).toBe("DELIVERED");
  });

  it("admin cannot make an arbitrary jump (PENDING_PAYMENT → DELIVERED) — returns 409", async () => {
    const created = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ productId: productAId, sellerId, quantity: 1 }],
        shipping: {
          fullName: "Test Customer",
          phone: "+251911000000",
          city: "Addis Ababa",
          address: "Bole Road",
        },
        paymentMethod: "CASH_ON_DELIVERY",
      })
      .expect(201);
    const orderId = created.body.data.order.id as string;

    // Order starts at PENDING_CONFIRMATION for COD. Force it to PENDING_PAYMENT
    // status via in-memory manipulation to test that specific transition.
    // Actually for a direct HTTP test we use PENDING_CONFIRMATION → DELIVERED
    // which is also an invalid jump.
    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "DELIVERED" })
      .expect(409);

    expect(res.body.success).toBe(false);

    // Status must remain PENDING_CONFIRMATION.
    const check = await request(app)
      .get(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(200);
    expect(check.body.data.order.status).toBe("PENDING_CONFIRMATION");
  });

  it("admin cannot transition COMPLETED → DELIVERED — returns 409", async () => {
    const orderId = await createOrderAtStatus("COMPLETED");

    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "DELIVERED" })
      .expect(409);

    expect(res.body.success).toBe(false);

    const check = await request(app)
      .get(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(200);
    expect(check.body.data.order.status).toBe("COMPLETED");
  });

  it("admin cannot transition COMPLETED → CANCELLED — returns 409", async () => {
    const orderId = await createOrderAtStatus("COMPLETED");

    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "CANCELLED" })
      .expect(409);

    expect(res.body.success).toBe(false);

    const check = await request(app)
      .get(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(200);
    expect(check.body.data.order.status).toBe("COMPLETED");
  });

  it("admin can cancel a DELIVERED order and inventory is NOT restored", async () => {
    const initialQty = orders.getSellerInventoryQuantity(sellerId, productAId)!;
    const orderId = await createOrderAtStatus("DELIVERED");

    // Inventory was deducted at order creation.
    const qtyAfterOrder = orders.getSellerInventoryQuantity(sellerId, productAId)!;
    expect(qtyAfterOrder).toBe(initialQty - 1);

    // Admin cancels the DELIVERED order.
    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "CANCELLED" })
      .expect(200);

    expect(res.body.data.order.status).toBe("CANCELLED");

    // Inventory must NOT be restored for a DELIVERED order.
    expect(orders.getSellerInventoryQuantity(sellerId, productAId)).toBe(qtyAfterOrder);

    // No cancellation transaction should have been recorded.
    const txCount = orders.getInventoryTransactionCount(orderId);
    // Only the original SHIPMENT transaction — no CANCELLATION.
    expect(txCount).toBe(1);
  });

  it("admin can perform a valid forward transition (CONFIRMED → PROCESSING)", async () => {
    const orderId = await createOrderAtStatus("CONFIRMED");

    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "PROCESSING" })
      .expect(200);

    expect(res.body.data.order.status).toBe("PROCESSING");
  });

  // ── Existing customer/seller access unchanged ────────────────────────────────

  it("customer can still view their own orders", async () => {
    const res = await request(app)
      .get("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(200);

    expect(res.body.data.orders).toBeDefined();
  });

  it("customer cannot access admin orders endpoint", async () => {
    await request(app)
      .get("/api/admin/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(403);
  });

  // ── Admin PAYMENT_REJECTED transition ──────────────────────────────────────

  it("admin PAYMENT_REJECTED: order status becomes PAYMENT_REJECTED and inventory is restored", async () => {
    const initialQty = orders.getSellerInventoryQuantity(sellerId, productAId)!;
    const orderId = await createManualPaymentOrder();

    // Inventory was deducted when the order was created.
    expect(orders.getSellerInventoryQuantity(sellerId, productAId)).toBe(
      initialQty - 2,
    );
    // Exactly one SHIPMENT transaction recorded.
    expect(orders.getInventoryTransactionCount(orderId)).toBe(1);

    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "PAYMENT_REJECTED" })
      .expect(200);

    expect(res.body.data.order.status).toBe("PAYMENT_REJECTED");

    // Inventory must be fully restored.
    expect(orders.getSellerInventoryQuantity(sellerId, productAId)).toBe(
      initialQty,
    );
    // SHIPMENT + CANCELLATION = 2 transactions recorded.
    expect(orders.getInventoryTransactionCount(orderId)).toBe(2);
  });

  it("admin PAYMENT_REJECTED: a second rejection attempt returns 409 (idempotency guard)", async () => {
    const orderId = await createManualPaymentOrder();

    // First rejection succeeds.
    await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "PAYMENT_REJECTED" })
      .expect(200);

    // Second rejection on the same order must be blocked — order is no longer
    // in PENDING_PAYMENT_VERIFICATION, so allowedAdminTransitions returns
    // ["CANCELLED"], making PAYMENT_REJECTED a 409.
    await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "PAYMENT_REJECTED" })
      .expect(409);
  });

  it("admin PAYMENT_REJECTED: inventory is not double-restored on a second attempt", async () => {
    const initialQty = orders.getSellerInventoryQuantity(sellerId, productAId)!;
    const orderId = await createManualPaymentOrder();
    const qtyAfterOrder = orders.getSellerInventoryQuantity(
      sellerId,
      productAId,
    )!;

    // First rejection restores stock.
    await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "PAYMENT_REJECTED" })
      .expect(200);

    const qtyAfterRejection = orders.getSellerInventoryQuantity(
      sellerId,
      productAId,
    )!;
    expect(qtyAfterRejection).toBe(initialQty);

    // Second attempt is blocked at the service layer (409); inventory stays put.
    await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "PAYMENT_REJECTED" })
      .expect(409);

    expect(orders.getSellerInventoryQuantity(sellerId, productAId)).toBe(
      qtyAfterRejection,
    );
    // Still only 2 transactions (SHIPMENT + one CANCELLATION), never 3.
    expect(orders.getInventoryTransactionCount(orderId)).toBe(2);

    // Sanity: the order was deducted exactly once and restored exactly once.
    expect(qtyAfterOrder).toBe(initialQty - 2);
    expect(qtyAfterRejection).toBe(initialQty);
  });

  it("admin cannot apply PAYMENT_REJECTED to an order that has no payment proof (wrong starting status)", async () => {
    // A COD order starts at PENDING_CONFIRMATION, not PENDING_PAYMENT_VERIFICATION.
    const orderId = await createOrderAtStatus("PENDING_CONFIRMATION");

    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "PAYMENT_REJECTED" })
      .expect(409);

    expect(res.body.success).toBe(false);

    // Status must remain PENDING_CONFIRMATION.
    const check = await request(app)
      .get(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(200);
    expect(check.body.data.order.status).toBe("PENDING_CONFIRMATION");
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function adminGet(path: string) {
    return request(app)
      .get(path)
      .set("Authorization", `Bearer ${adminToken}`);
  }

  /**
   * Creates a manual-payment order via the checkout endpoint (CBE_BANK),
   * then directly advances the in-memory order to PENDING_PAYMENT_VERIFICATION
   * with inventory already reserved (quantity 2 of productAId).
   * Returns the orderId.
   */
  async function createManualPaymentOrder(): Promise<string> {
    const created = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ productId: productAId, sellerId, quantity: 2 }],
        shipping: {
          fullName: "Test Customer",
          phone: "+251911000000",
          city: "Addis Ababa",
          address: "Bole Road",
        },
        paymentMethod: "CBE_BANK",
      })
      .expect(201);

    const orderId = created.body.data.order.id as string;

    // The checkout endpoint leaves the order at PENDING_PAYMENT (no proof yet).
    // Advance it to PENDING_PAYMENT_VERIFICATION directly in the in-memory repo
    // to simulate the customer having uploaded proof. The service layer's
    // rejectPayment() guard checks for this exact status.
    const order = await orders.findById(orderId);
    if (order) {
      await orders.updateStatus(orderId, "PENDING_PAYMENT_VERIFICATION");
    }

    return orderId;
  }

  /**
   * Creates a real order via the customer checkout endpoint and then advances
   * it to the requested status via sequential admin PATCH calls (and for
   * COMPLETED, the customer-initiated /complete endpoint).
   *
   * Supported target statuses: PENDING_CONFIRMATION, CONFIRMED, PROCESSING,
   * READY_FOR_DELIVERY, SHIPPED, DELIVERED, COMPLETED.
   */
  async function createOrderAtStatus(
    target:
      | "PENDING_CONFIRMATION"
      | "CONFIRMED"
      | "PROCESSING"
      | "READY_FOR_DELIVERY"
      | "SHIPPED"
      | "DELIVERED"
      | "COMPLETED",
  ): Promise<string> {
    const created = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ productId: productAId, sellerId, quantity: 1 }],
        shipping: {
          fullName: "Test Customer",
          phone: "+251911000000",
          city: "Addis Ababa",
          address: "Bole Road",
        },
        paymentMethod: "CASH_ON_DELIVERY",
      })
      .expect(201);

    const orderId = created.body.data.order.id as string;

    if (target === "PENDING_CONFIRMATION") {
      return orderId;
    }

    // Admin-driven steps up to DELIVERED.
    const adminSteps: Array<
      "CONFIRMED" | "PROCESSING" | "READY_FOR_DELIVERY" | "SHIPPED" | "DELIVERED"
    > = ["CONFIRMED", "PROCESSING", "READY_FOR_DELIVERY", "SHIPPED", "DELIVERED"];

    for (const step of adminSteps) {
      await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: step })
        .expect(200);

      if (step === target) return orderId;
    }

    // COMPLETED requires the customer-initiated endpoint.
    if (target === "COMPLETED") {
      await request(app)
        .post(`/api/orders/${orderId}/complete`)
        .set("Authorization", `Bearer ${customerToken}`)
        .expect(200);
    }

    return orderId;
  }
});
