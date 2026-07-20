import { randomUUID } from "node:crypto";
import pino from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { JwtTokenService } from "../src/services/token.service.js";
import { InMemoryOrderRepository } from "./helpers/in-memory-order.repository.js";
import { InMemoryUserRepository } from "./helpers/in-memory-user.repository.js";

const customerId = randomUUID();
const otherCustomerId = randomUUID();
const sellerId = randomUUID();
const secondSellerId = randomUUID();
const firstProductId = randomUUID();
const secondProductId = randomUUID();
const ownProductId = randomUUID();

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

    users = new InMemoryUserRepository();
    const adminId = randomUUID();
    users.addUser({ id: customerId, role: "CUSTOMER" });
    users.addUser({ id: otherCustomerId, role: "CUSTOMER" });
    users.addUser({ id: adminId, role: "ADMIN" });

    app = createApp({
      userRepository: users,
      orderRepository: orders,
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
      { productId: firstProductId, quantity: 2 },
      { productId: secondProductId, quantity: 1 },
    ]);

    expect(response.body.data.order).toMatchObject({
      customerId,
      status: "PENDING",
      totalAmount: "250.00",
      items: [
        { productId: firstProductId, quantity: 2, price: "100.00" },
        { productId: secondProductId, quantity: 1, price: "50.00" },
      ],
    });
  });

  it("rejects insufficient stock and rolls back every stock change", async () => {
    const response = await createOrder(
      customerToken,
      [
        { productId: firstProductId, quantity: 2 },
        { productId: secondProductId, quantity: 3 },
      ],
      409,
    );

    expect(response.body.message).toBe(
      `Insufficient stock for product ${secondProductId}.`,
    );
    expect(orders.getProductQuantity(firstProductId)).toBe(10);
    expect(orders.getProductQuantity(secondProductId)).toBe(2);
  });

  it("prevents a customer from ordering their own product", async () => {
    const response = await createOrder(
      customerToken,
      [{ productId: ownProductId, quantity: 1 }],
      403,
    );

    expect(response.body.message).toBe(
      "Customers cannot order their own products.",
    );
    expect(orders.getProductQuantity(ownProductId)).toBe(5);
  });

  it("reduces product stock after successful order creation", async () => {
    await createOrder(customerToken, [
      { productId: firstProductId, quantity: 3 },
    ]);

    expect(orders.getProductQuantity(firstProductId)).toBe(7);
  });

  it("returns only the authenticated customer's orders", async () => {
    const ownOrder = await createOrder(customerToken, [
      { productId: firstProductId, quantity: 1 },
    ]);
    await createOrder(otherCustomerToken, [
      { productId: secondProductId, quantity: 1 },
    ]);

    const response = await request(app)
      .get("/api/orders/me")
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(200);

    expect(response.body.data.orders).toHaveLength(1);
    expect(response.body.data.orders[0].id).toBe(
      ownOrder.body.data.order.id,
    );
  });

  it("allows an order owner to view order details", async () => {
    const created = await createOrder(customerToken, [
      { productId: firstProductId, quantity: 1 },
    ]);

    const response = await request(app)
      .get(`/api/orders/${created.body.data.order.id}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(200);

    expect(response.body.data.order.customerId).toBe(customerId);
  });

  it("allows an admin to view any order", async () => {
    const created = await createOrder(customerToken, [
      { productId: firstProductId, quantity: 1 },
    ]);

    await request(app)
      .get(`/api/orders/${created.body.data.order.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });

  it("rejects unauthenticated and non-owner order access", async () => {
    const created = await createOrder(customerToken, [
      { productId: firstProductId, quantity: 1 },
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

  it("allows the owner to cancel a pending order and restores stock", async () => {
    const created = await createOrder(customerToken, [
      { productId: firstProductId, quantity: 2 },
    ]);
    const orderId = created.body.data.order.id as string;
    expect(orders.getProductQuantity(firstProductId)).toBe(8);

    await request(app)
      .delete(`/api/orders/${orderId}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({})
      .expect(200);

    expect(orders.getProductQuantity(firstProductId)).toBe(10);
    expect((await orders.findById(orderId))?.status).toBe("CANCELLED");
  });

  it("prevents a customer from cancelling a delivered order", async () => {
    const created = await createOrder(customerToken, [
      { productId: firstProductId, quantity: 2 },
    ]);
    const orderId = created.body.data.order.id as string;

    await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "DELIVERED" })
      .expect(200);

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
    items: Array<{ productId: string; quantity: number }>,
    status = 201,
  ) {
    return request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({ items })
      .expect(status);
  }
});
