import { randomUUID } from "node:crypto";
import pino from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { JwtTokenService } from "../src/services/token.service.js";
import { InMemoryOrderRepository } from "./helpers/in-memory-order.repository.js";
import { InMemorySellerPaymentRepository } from "./helpers/in-memory-seller-payment.repository.js";
import { InMemoryUserRepository } from "./helpers/in-memory-user.repository.js";

const customerId = randomUUID();
const otherCustomerId = randomUUID();
const sellerId = randomUUID();
const secondSellerId = randomUUID();
const firstProductId = randomUUID();
const secondProductId = randomUUID();
const ownProductId = randomUUID();
const zeroStockProductId = randomUUID();
const largeStockProductId = randomUUID();
const shipping = {
  fullName: "Primary Customer",
  phone: "+251911000000",
  city: "Addis Ababa",
  address: "Bole Road, construction site gate 2",
  notes: "Call the site manager before delivery.",
};
const manualPaymentConfiguration = [
  {
    method: "TELEBIRR",
    providerName: "Telebirr",
    accountName: "Construction Materials Marketplace",
    accountNumber: "0911000000",
    accountNumberLabel: "Payment number",
  },
  {
    method: "CBE_BIRR",
    providerName: "CBE Birr",
    accountName: "Construction Materials Marketplace",
    accountNumber: "0911000001",
    accountNumberLabel: "Payment number",
  },
  {
    method: "CBE_BANK",
    providerName: "CBE Bank",
    accountName: "Construction Materials Marketplace",
    accountNumber: "1000123456789",
    accountNumberLabel: "Account number",
  },
  {
    method: "AWASH_BANK",
    providerName: "Awash Bank",
    accountName: "Construction Materials Marketplace",
    accountNumber: "0134012345678",
    accountNumberLabel: "Account number",
  },
  {
    method: "DASHEN_BANK",
    providerName: "Dashen Bank",
    accountName: "Construction Materials Marketplace",
    accountNumber: "1800123456789",
    accountNumberLabel: "Account number",
  },
  {
    method: "E_BIRR",
    providerName: "E-birr",
    accountName: "Construction Materials Marketplace",
    accountNumber: "0911000003",
    accountNumberLabel: "Payment number",
  },
] as const;

describe("Order API", () => {
  const tokenService = new JwtTokenService();
  let app: ReturnType<typeof createApp>;
  let orders: InMemoryOrderRepository;
  let users: InMemoryUserRepository;
  let customerToken: string;
  let otherCustomerToken: string;
  let adminToken: string;

  beforeEach(() => {
    orders = new InMemoryOrderRepository();
    orders.addCustomer({
      id: customerId,
      name: "Primary Customer",
      email: "primary@example.com",
    });
    orders.addCustomer({
      id: otherCustomerId,
      name: "Other Customer",
      email: "other@example.com",
    });
    orders.addProduct({
      id: firstProductId,
      sellerId,
      name: "Cement",
      imageUrl: null,
      price: "100.00",
      quantity: 10,
    });
    orders.addProduct({
      id: secondProductId,
      sellerId: secondSellerId,
      name: "Steel Bar",
      imageUrl: null,
      price: "50.00",
      quantity: 2,
    });
    orders.addProduct({
      id: ownProductId,
      sellerId: customerId,
      name: "Customer-owned Timber",
      imageUrl: null,
      price: "25.00",
      quantity: 5,
    });
    orders.addProduct({
      id: zeroStockProductId,
      sellerId,
      name: "Unavailable Sand",
      imageUrl: null,
      price: "10.00",
      quantity: 0,
    });
    orders.addProduct({
      id: largeStockProductId,
      sellerId,
      name: "Bulk Aggregate",
      imageUrl: null,
      price: "1.00",
      quantity: 1_000_000,
    });

    users = new InMemoryUserRepository();
    const adminId = randomUUID();
    users.addUser({ id: customerId, role: "CUSTOMER" });
    users.addUser({ id: otherCustomerId, role: "CUSTOMER" });
    users.addUser({ id: adminId, role: "ADMIN" });
    const sellerPayments = new InMemorySellerPaymentRepository();
    sellerPayments.addProduct(firstProductId, sellerId);
    sellerPayments.addProduct(secondProductId, secondSellerId);
    sellerPayments.addProduct(ownProductId, customerId);
    sellerPayments.addProduct(zeroStockProductId, sellerId);
    sellerPayments.addProduct(largeStockProductId, sellerId);
    sellerPayments.addProfile({
      sellerId,
      sellerName: "Primary Seller",
      sellerPhone: "+251911100100",
      destinations: [...manualPaymentConfiguration],
    });

    app = createApp({
      userRepository: users,
      orderRepository: orders,
      sellerPaymentRepository: sellerPayments,
      tokenService,
      logger: pino({ level: "silent" }),
    });

    customerToken = tokenService.createAccessToken({
      userId: customerId,
      role: "CUSTOMER",
    });
    otherCustomerToken = tokenService.createAccessToken({
      userId: otherCustomerId,
      role: "CUSTOMER",
    });
    adminToken = tokenService.createAccessToken({
      userId: adminId,
      role: "ADMIN",
    });
  });

  it("creates an order successfully and calculates the total amount", async () => {
    const response = await createOrder(customerToken, [
      { productId: firstProductId, sellerId, quantity: 2 },
      { productId: secondProductId, sellerId: secondSellerId, quantity: 1 },
    ]);

    expect(response.body.data.order).toMatchObject({
      customerId,
      status: "PENDING_CONFIRMATION",
      paymentMethod: "CASH_ON_DELIVERY",
      totalAmount: "250.00",
      shippingFullName: shipping.fullName,
      shippingPhone: shipping.phone,
      shippingCity: shipping.city,
      shippingAddress: shipping.address,
      shippingNotes: shipping.notes,
      items: [
        {
          productId: firstProductId,
          quantity: 2,
          unitPrice: "100.00",
          subtotal: "200.00",
        },
        {
          productId: secondProductId,
          quantity: 1,
          unitPrice: "50.00",
          subtotal: "50.00",
        },
      ],
    });
    expect(response.body.data.manualPaymentInstructions).toBeUndefined();
    expect(orders.getProductQuantity(firstProductId)).toBe(8);
    expect(orders.getProductQuantity(secondProductId)).toBe(1);
    expect(
      orders.getInventoryTransactionCount(response.body.data.order.id),
    ).toBe(2);
  });

  it.each(manualPaymentConfiguration)(
    "creates $method orders and returns payment instructions",
    async (destination) => {
      const response = await createOrder(
        customerToken,
        [{ productId: firstProductId, sellerId, quantity: 1 }],
        201,
        destination.method,
      );

      expect(response.body.data.order).toMatchObject({
        paymentMethod: destination.method,
        status: "PENDING_PAYMENT",
      });
      expect(response.body.data.manualPaymentInstructions).toEqual({
        paymentDestination: destination,
        paymentReference: response.body.data.order.id,
        amount: "100.00",
        receiptUploadInstructions: expect.stringContaining("screenshot"),
      });
    },
  );

  it("rejects digital payment for a mixed-seller cart", async () => {
    const response = await createOrder(
      customerToken,
      [
        { productId: firstProductId, sellerId, quantity: 1 },
        { productId: secondProductId, sellerId: secondSellerId, quantity: 1 },
      ],
      400,
      "TELEBIRR",
    );

    expect(response.body.message).toContain("one seller");
  });

  it.each(["ONLINE_PAYMENT", "CRYPTO"])(
    "rejects unsupported payment method %s",
    async (paymentMethod) => {
      const response = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          items: [{ productId: firstProductId, sellerId, quantity: 1 }],
          shipping,
          paymentMethod,
        })
        .expect(400);

      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "body.paymentMethod" }),
        ]),
      );
    },
  );

  it("validates shipping, payment, product IDs, and quantities", async () => {
    const response = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ productId: "not-a-uuid", sellerId: "not-a-uuid", quantity: 0 }],
        shipping: {
          fullName: "",
          phone: "",
          city: "",
          address: "",
        },
        paymentMethod: "CRYPTO",
      })
      .expect(400);

    expect(response.body.message).toBe("Request validation failed.");
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "body.items.0.productId" }),
        expect.objectContaining({ field: "body.items.0.sellerId" }),
        expect.objectContaining({ field: "body.items.0.quantity" }),
        expect.objectContaining({ field: "body.shipping.fullName" }),
        expect.objectContaining({ field: "body.shipping.phone" }),
        expect.objectContaining({ field: "body.shipping.city" }),
        expect.objectContaining({ field: "body.shipping.address" }),
        expect.objectContaining({ field: "body.paymentMethod" }),
      ]),
    );
  });

  it("rejects insufficient stock and rolls back every stock change", async () => {
    const response = await createOrder(
      customerToken,
      [
        { productId: firstProductId, sellerId, quantity: 2 },
        { productId: secondProductId, sellerId: secondSellerId, quantity: 3 },
      ],
      409,
    );

    expect(response.body.message).toBe(
      `Insufficient stock for product ${secondProductId}.`,
    );
    expect(orders.getProductQuantity(firstProductId)).toBe(10);
    expect(orders.getProductQuantity(secondProductId)).toBe(2);
  });

  it("reserves the last available item without making stock negative", async () => {
    const response = await createOrder(customerToken, [
      { productId: secondProductId, sellerId: secondSellerId, quantity: 2 },
    ]);

    expect(orders.getProductQuantity(secondProductId)).toBe(0);
    expect(
      orders.getInventoryTransactionCount(response.body.data.order.id),
    ).toBe(1);

    await createOrder(
      otherCustomerToken,
      [{ productId: secondProductId, sellerId: secondSellerId, quantity: 1 }],
      409,
    );
    expect(orders.getProductQuantity(secondProductId)).toBe(0);
  });

  it("rejects an order when product stock is zero", async () => {
    await createOrder(
      customerToken,
      [{ productId: zeroStockProductId, sellerId, quantity: 1 }],
      409,
    );

    expect(orders.getProductQuantity(zeroStockProductId)).toBe(0);
  });

  it("supports large quantity orders within the inventory limit", async () => {
    const response = await createOrder(customerToken, [
      { productId: largeStockProductId, sellerId, quantity: 750_000 },
    ]);

    expect(response.body.data.order.totalAmount).toBe("750000.00");
    expect(orders.getProductQuantity(largeStockProductId)).toBe(250_000);
  });

  it.each([0, -1, 1.5, "1.5", 2_147_483_648])(
    "rejects invalid order quantity %s",
    async (quantity) => {
      const response = await request(app)
        .post("/api/orders")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({
          items: [{ productId: firstProductId, sellerId, quantity }],
          shipping,
          paymentMethod: "CASH_ON_DELIVERY",
        })
        .expect(400);

      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "body.items.0.quantity" }),
        ]),
      );
      expect(orders.getProductQuantity(firstProductId)).toBe(10);
    },
  );

  it("prevents concurrent orders from overselling shared stock", async () => {
    const attempts = await Promise.all([
      createOrderRequest(customerToken, [
        { productId: firstProductId, sellerId, quantity: 6 },
      ]),
      createOrderRequest(otherCustomerToken, [
        { productId: firstProductId, sellerId, quantity: 6 },
      ]),
    ]);

    expect(attempts.map((attempt) => attempt.status).sort()).toEqual([
      201,
      409,
    ]);
    expect(orders.getProductQuantity(firstProductId)).toBe(4);
  });

  it("prevents a customer from ordering their own product", async () => {
    const response = await createOrder(
      customerToken,
      [{ productId: ownProductId, sellerId: customerId, quantity: 1 }],
      403,
    );

    expect(response.body.message).toBe(
      "Customers cannot order their own products.",
    );
    expect(orders.getProductQuantity(ownProductId)).toBe(5);
  });

  it("does not deduct reserved stock again when the order is shipped", async () => {
    const created = await createOrder(customerToken, [
      { productId: firstProductId, sellerId, quantity: 3 },
    ]);
    const orderId = created.body.data.order.id as string;

    expect(orders.getProductQuantity(firstProductId)).toBe(7);
    expect(orders.getInventoryTransactionCount(orderId)).toBe(1);

    await advanceOrderToStatus(orderId, "SHIPPED");

    expect(orders.getProductQuantity(firstProductId)).toBe(7);
    expect(orders.getInventoryTransactionCount(orderId)).toBe(1);

    // Idempotent: setting SHIPPED again should not change stock or add transactions.
    await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "DELIVERED" })
      .expect(200);

    expect(orders.getProductQuantity(firstProductId)).toBe(7);
    expect(orders.getInventoryTransactionCount(orderId)).toBe(1);
  });

  it("returns only the authenticated customer's orders", async () => {
    const ownOrder = await createOrder(customerToken, [
      { productId: firstProductId, sellerId, quantity: 1 },
    ]);
    await createOrder(otherCustomerToken, [
      { productId: secondProductId, sellerId: secondSellerId, quantity: 1 },
    ]);

    const response = await request(app)
      .get("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(200);

    expect(response.body.data.orders).toHaveLength(1);
    expect(response.body.data.orders[0].id).toBe(
      ownOrder.body.data.order.id,
    );
  });

  it("allows an order owner to view order details", async () => {
    const created = await createOrder(customerToken, [
      { productId: firstProductId, sellerId, quantity: 1 },
    ]);

    const response = await request(app)
      .get(`/api/orders/${created.body.data.order.id}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(200);

    expect(response.body.data.order.customerId).toBe(customerId);
  });

  it("allows an admin to view any order", async () => {
    const created = await createOrder(customerToken, [
      { productId: firstProductId, sellerId, quantity: 1 },
    ]);

    await request(app)
      .get(`/api/orders/${created.body.data.order.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });

  it("rejects unauthenticated and non-owner order access", async () => {
    const created = await createOrder(customerToken, [
      { productId: firstProductId, sellerId, quantity: 1 },
    ]);
    const orderId = created.body.data.order.id as string;

    await request(app).get(`/api/orders/${orderId}`).expect(401);

    const forbiddenResponse = await request(app)
      .get(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${otherCustomerToken}`)
      .expect(403);

    expect(forbiddenResponse.body.message).toBe(
      "You can only view your own orders.",
    );
  });

  it("rejects SELLER token on GET /api/orders/:id (route-level guard)", async () => {
    const created = await createOrder(customerToken, [
      { productId: firstProductId, sellerId, quantity: 1 },
    ]);
    const orderId = created.body.data.order.id as string;

    // Register the seller in the user store so the token resolves.
    users.addUser({ id: sellerId, role: "SELLER" });
    const sellerToken = tokenService.createAccessToken({
      userId: sellerId,
      role: "SELLER",
    });

    await request(app)
      .get(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .expect(403);
  });

  it("rejects SELLER token on DELETE /api/orders/:id (route-level guard)", async () => {
    const created = await createOrder(customerToken, [
      { productId: firstProductId, sellerId, quantity: 1 },
    ]);
    const orderId = created.body.data.order.id as string;

    users.addUser({ id: sellerId, role: "SELLER" });
    const sellerToken = tokenService.createAccessToken({
      userId: sellerId,
      role: "SELLER",
    });

    await request(app)
      .delete(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .expect(403);

    // Order must remain unchanged — no cancellation occurred.
    expect((await orders.findById(orderId))?.status).toBe(
      "PENDING_CONFIRMATION",
    );
  });

  it("allows the customer to complete a delivered order", async () => {
    const created = await createOrder(customerToken, [
      { productId: firstProductId, sellerId, quantity: 1 },
    ]);
    const orderId = created.body.data.order.id as string;

    await advanceOrderToStatus(orderId, "DELIVERED");

    const response = await request(app)
      .post(`/api/orders/${orderId}/complete`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({})
      .expect(200);

    expect(response.body.data.order.status).toBe("COMPLETED");
    expect((await orders.findById(orderId))?.status).toBe("COMPLETED");

    await request(app)
      .post(`/api/orders/${orderId}/complete`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({})
      .expect(200);

    await request(app)
      .delete(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({})
      .expect(409);

    expect(orders.getProductQuantity(firstProductId)).toBe(9);
    expect((await orders.findById(orderId))?.status).toBe("COMPLETED");
  });

  it("rejects completion before delivery or by another customer", async () => {
    const created = await createOrder(customerToken, [
      { productId: firstProductId, sellerId, quantity: 1 },
    ]);
    const orderId = created.body.data.order.id as string;

    const earlyResponse = await request(app)
      .post(`/api/orders/${orderId}/complete`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({})
      .expect(409);

    expect(earlyResponse.body.message).toBe(
      "Only delivered orders can be marked completed.",
    );

    await advanceOrderToStatus(orderId, "DELIVERED");

    const forbiddenResponse = await request(app)
      .post(`/api/orders/${orderId}/complete`)
      .set("Authorization", `Bearer ${otherCustomerToken}`)
      .send({})
      .expect(403);

    expect(forbiddenResponse.body.message).toBe(
      "You can only complete your own orders.",
    );
  });

  it("requires a customer session to complete an order", async () => {
    const created = await createOrder(customerToken, [
      { productId: firstProductId, sellerId, quantity: 1 },
    ]);
    const orderId = created.body.data.order.id as string;

    await request(app)
      .post(`/api/orders/${orderId}/complete`)
      .send({})
      .expect(401);

    await request(app)
      .post(`/api/orders/${orderId}/complete`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({})
      .expect(403);
  });

  it("allows the owner to cancel a pending order and restores stock", async () => {
    const created = await createOrder(customerToken, [
      { productId: firstProductId, sellerId, quantity: 2 },
    ]);
    const orderId = created.body.data.order.id as string;
    expect(orders.getProductQuantity(firstProductId)).toBe(8);

    await request(app)
      .delete(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({})
      .expect(200);

    expect(orders.getProductQuantity(firstProductId)).toBe(10);
    expect(orders.getInventoryTransactionCount(orderId)).toBe(2);
    expect((await orders.findById(orderId))?.status).toBe("CANCELLED");
  });

  it("prevents a customer from cancelling a delivered order", async () => {
    const created = await createOrder(customerToken, [
      { productId: firstProductId, sellerId, quantity: 2 },
    ]);
    const orderId = created.body.data.order.id as string;

    await advanceOrderToStatus(orderId, "DELIVERED");

    const response = await request(app)
      .delete(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({})
      .expect(409);

    expect(response.body.message).toBe(
      "Only pending orders can be cancelled by customers.",
    );
    expect(orders.getProductQuantity(firstProductId)).toBe(8);

    await request(app)
      .delete(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({})
      .expect(200);
    expect(orders.getProductQuantity(firstProductId)).toBe(8);
  });

  async function createOrder(
    token: string,
    items: Array<{ productId: string; sellerId: string; quantity: number }>,
    status = 201,
    paymentMethod:
      | "CASH_ON_DELIVERY"
      | "TELEBIRR"
      | "CBE_BIRR"
      | "AWASH_BIRR"
      | "BANK_TRANSFER"
      | "CBE_BANK"
      | "AWASH_BANK"
      | "DASHEN_BANK"
      | "E_BIRR" = "CASH_ON_DELIVERY",
  ) {
    return request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items, shipping, paymentMethod })
      .expect(status);
  }

  function createOrderRequest(
    token: string,
    items: Array<{ productId: string; sellerId: string; quantity: number }>,
  ) {
    return request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        items,
        shipping,
        paymentMethod: "CASH_ON_DELIVERY",
      });
  }

  /**
   * Advance a COD order (starts at PENDING_CONFIRMATION) to the requested
   * status by issuing sequential admin PATCH calls.
   * Valid targets: CONFIRMED, PROCESSING, READY_FOR_DELIVERY, SHIPPED, DELIVERED.
   */
  async function advanceOrderToStatus(
    orderId: string,
    target: "CONFIRMED" | "PROCESSING" | "READY_FOR_DELIVERY" | "SHIPPED" | "DELIVERED",
  ): Promise<void> {
    const steps: Array<
      "CONFIRMED" | "PROCESSING" | "READY_FOR_DELIVERY" | "SHIPPED" | "DELIVERED"
    > = ["CONFIRMED", "PROCESSING", "READY_FOR_DELIVERY", "SHIPPED", "DELIVERED"];

    for (const step of steps) {
      await request(app)
        .patch(`/api/orders/${orderId}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: step })
        .expect(200);

      if (step === target) return;
    }
  }
});
