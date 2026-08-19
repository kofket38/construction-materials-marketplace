/**
 * Seller product creation tests.
 *
 * POST /api/products is the existing product creation endpoint.
 * These tests verify seller authorization, field validation,
 * sellerId injection from JWT, and category ownership.
 */
import { randomUUID } from "node:crypto";
import pino from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { JwtTokenService } from "../src/services/token.service.js";
import { InMemoryProductRepository } from "./helpers/in-memory-product.repository.js";
import { InMemoryUserRepository } from "./helpers/in-memory-user.repository.js";

const sellerId = randomUUID();
const otherSellerId = randomUUID();
const customerId = randomUUID();
const adminId = randomUUID();
const categoryId = randomUUID();

const validProductBody = {
  name: "Portland Cement 42.5N",
  description: "High-strength cement in 50 kg bags, suitable for structural concrete.",
  price: "850.00",
  quantity: 0,
  categoryId,
};

describe("Seller Product Creation", () => {
  const tokenService = new JwtTokenService();
  let products: InMemoryProductRepository;
  let users: InMemoryUserRepository;
  let app: ReturnType<typeof createApp>;
  let sellerToken: string;
  let otherSellerToken: string;
  let customerToken: string;
  let adminToken: string;

  beforeEach(() => {
    products = new InMemoryProductRepository();
    products.addCategory({ id: categoryId, name: "Cement" });
    products.addSeller(sellerId, "Seller One", "Seller One Shop");
    products.addSeller(otherSellerId, "Seller Two", "Seller Two Shop");

    users = new InMemoryUserRepository();
    users.addUser({ id: sellerId, role: "SELLER" });
    users.addUser({ id: otherSellerId, role: "SELLER" });
    users.addUser({ id: customerId, role: "CUSTOMER" });
    users.addUser({ id: adminId, role: "ADMIN" });

    app = createApp({
      userRepository: users,
      productRepository: products,
      tokenService,
      logger: pino({ level: "silent" }),
    });

    sellerToken = tokenService.createAccessToken({ userId: sellerId, role: "SELLER" });
    otherSellerToken = tokenService.createAccessToken({ userId: otherSellerId, role: "SELLER" });
    customerToken = tokenService.createAccessToken({ userId: customerId, role: "CUSTOMER" });
    adminToken = tokenService.createAccessToken({ userId: adminId, role: "ADMIN" });
  });

  // ── Authorization ──────────────────────────────────────────────────────────

  it("requires authentication to create a product", async () => {
    await request(app)
      .post("/api/products")
      .send(validProductBody)
      .expect(401);
  });

  it("allows a seller to create a product", async () => {
    const res = await createProduct(sellerToken, validProductBody, 201);

    const product = res.body.data.product;
    expect(product.sellerId).toBe(sellerId);     // from JWT, not body
    expect(product.name).toBe("Portland Cement 42.5N");
    expect(product.price).toBe("850.00");
    expect(product.quantity).toBe(0);
    expect(product.categoryId).toBe(categoryId);
  });

  it("rejects product creation by a customer", async () => {
    await createProduct(customerToken, validProductBody, 403);
  });

  it("rejects product creation by an admin", async () => {
    await createProduct(adminToken, validProductBody, 403);
  });

  // ── sellerId from JWT, never from body ─────────────────────────────────────

  it("sellerId is always taken from JWT — body sellerId is rejected", async () => {
    const bodyWithSellerId = { ...validProductBody, sellerId: otherSellerId };
    // Strict schema rejects unknown field
    const res = await createProduct(sellerToken, bodyWithSellerId, 400);
    expect(res.body.message).toBe("Request validation failed.");
  });

  it("two sellers create products independently", async () => {
    const resA = await createProduct(sellerToken, validProductBody, 201);
    const resB = await createProduct(otherSellerToken, { ...validProductBody, name: "Steel Rod 12mm" }, 201);

    expect(resA.body.data.product.sellerId).toBe(sellerId);
    expect(resB.body.data.product.sellerId).toBe(otherSellerId);
    expect(resA.body.data.product.id).not.toBe(resB.body.data.product.id);
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  it("rejects missing name", async () => {
    const res = await createProduct(sellerToken, { ...validProductBody, name: "" }, 400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "body.name" })]),
    );
  });

  it("rejects missing description", async () => {
    const res = await createProduct(sellerToken, { ...validProductBody, description: "" }, 400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "body.description" })]),
    );
  });

  it("rejects zero or negative price", async () => {
    const zeroRes = await createProduct(sellerToken, { ...validProductBody, price: "0" }, 400);
    expect(zeroRes.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "body.price" })]),
    );

    const negRes = await createProduct(sellerToken, { ...validProductBody, price: "-1.00" }, 400);
    expect(negRes.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "body.price" })]),
    );
  });

  it("rejects negative quantity", async () => {
    const res = await createProduct(sellerToken, { ...validProductBody, quantity: -1 }, 400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "body.quantity" })]),
    );
  });

  it("rejects invalid categoryId", async () => {
    const res = await createProduct(sellerToken, { ...validProductBody, categoryId: "not-a-uuid" }, 400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "body.categoryId" })]),
    );
  });

  it("rejects a non-existent category", async () => {
    const res = await createProduct(
      sellerToken,
      { ...validProductBody, categoryId: randomUUID() },
      404,
    );
    expect(res.body.message).toBe("The selected category does not exist.");
  });

  it("accepts any valid URL as imageUrl (protocol validation applies to managed images only)", async () => {
    // createProductBodySchema uses z.string().url() without the HTTP-only refine
    const res = await createProduct(sellerToken, {
      ...validProductBody,
      imageUrl: "https://example.com/cement.jpg",
    }, 201);
    expect(res.body.data.product.imageUrl).toBe("https://example.com/cement.jpg");
  });

  it("rejects unknown body fields", async () => {
    await createProduct(sellerToken, { ...validProductBody, extraField: "bad" }, 400);
  });

  // ── Product is visible after creation ──────────────────────────────────────

  it("created product is immediately accessible via GET /api/products/:id", async () => {
    const created = await createProduct(sellerToken, validProductBody, 201);
    const productId = created.body.data.product.id as string;

    const fetched = await request(app).get(`/api/products/${productId}`).expect(200);
    expect(fetched.body.data.product.id).toBe(productId);
    expect(fetched.body.data.product.sellerId).toBe(sellerId);
  });

  // ── Helper ─────────────────────────────────────────────────────────────────

  function createProduct(token: string, body: object, expectedStatus: number) {
    return request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send(body)
      .expect(expectedStatus);
  }
});
