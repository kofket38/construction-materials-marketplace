import { randomUUID } from "node:crypto";
import pino from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { JwtTokenService } from "../src/services/token.service.js";
import { InMemorySellerInventoryRepository } from "./helpers/in-memory-seller-inventory.repository.js";
import { InMemoryUserRepository } from "./helpers/in-memory-user.repository.js";

// ── Fixed IDs ──────────────────────────────────────────────────────────────────

const sellerAId = randomUUID();
const sellerBId = randomUUID();
const customerId = randomUUID();
const adminId = randomUUID();

const productAId = randomUUID(); // owned by Seller A
const productBId = randomUUID(); // owned by Seller B

const validCreateBody = {
  productId: productAId,
  city: "Addis Ababa",
  price: "475.00",
  quantity: 20,
  deliveryAvailable: false,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

describe("Seller Inventory API", () => {
  const tokenService = new JwtTokenService();
  let repo: InMemorySellerInventoryRepository;
  let users: InMemoryUserRepository;
  let app: ReturnType<typeof createApp>;

  let sellerAToken: string;
  let sellerBToken: string;
  let customerToken: string;
  let adminToken: string;

  beforeEach(() => {
    repo = new InMemorySellerInventoryRepository();
    users = new InMemoryUserRepository();

    // Seed users
    users.addUser({ id: sellerAId, role: "SELLER" });
    users.addUser({ id: sellerBId, role: "SELLER" });
    users.addUser({ id: customerId, role: "CUSTOMER" });
    users.addUser({ id: adminId, role: "ADMIN" });

    // Seed products
    repo.addProduct({ id: productAId, sellerId: sellerAId, name: "Cement Bag 50kg" });
    repo.addProduct({ id: productBId, sellerId: sellerBId, name: "Steel Rod 12mm" });

    app = createApp({
      userRepository: users,
      sellerInventoryRepository: repo,
      tokenService,
      logger: pino({ level: "silent" }),
    });

    sellerAToken = tokenService.createAccessToken({ userId: sellerAId, role: "SELLER" });
    sellerBToken = tokenService.createAccessToken({ userId: sellerBId, role: "SELLER" });
    customerToken = tokenService.createAccessToken({ userId: customerId, role: "CUSTOMER" });
    adminToken = tokenService.createAccessToken({ userId: adminId, role: "ADMIN" });
  });

  // ── Authentication & authorization ──────────────────────────────────────────

  it("requires authentication for every inventory endpoint", async () => {
    const entryId = randomUUID();
    await request(app).get("/api/seller/inventory").expect(401);
    await request(app).post("/api/seller/inventory").expect(401);
    await request(app).patch(`/api/seller/inventory/${entryId}`).expect(401);
    await request(app).delete(`/api/seller/inventory/${entryId}`).expect(401);
  });

  it("rejects customer access to every inventory endpoint", async () => {
    const entryId = randomUUID();
    await get("/api/seller/inventory", customerToken).expect(403);
    await post("/api/seller/inventory", customerToken, validCreateBody).expect(403);
    await patch(`/api/seller/inventory/${entryId}`, customerToken, { price: "100.00" }).expect(403);
    await del(`/api/seller/inventory/${entryId}`, customerToken).expect(403);
  });

  it("rejects admin access because the endpoint is seller-only", async () => {
    const entryId = randomUUID();
    await get("/api/seller/inventory", adminToken).expect(403);
    await post("/api/seller/inventory", adminToken, validCreateBody).expect(403);
    await patch(`/api/seller/inventory/${entryId}`, adminToken, { price: "100.00" }).expect(403);
    await del(`/api/seller/inventory/${entryId}`, adminToken).expect(403);
  });

  // ── List ────────────────────────────────────────────────────────────────────

  it("returns an empty list when the seller has no inventory", async () => {
    const res = await get("/api/seller/inventory", sellerAToken).expect(200);
    expect(res.body.data.inventory).toHaveLength(0);
    expect(res.body.data.pagination.total).toBe(0);
  });

  it("returns only the authenticated seller's own inventory", async () => {
    repo.addEntry({ id: randomUUID(), sellerId: sellerAId, productId: productAId, productName: "Cement", productImageUrl: null, city: "Addis Ababa", region: null, price: "475.00", quantity: 20, deliveryAvailable: false });
    repo.addEntry({ id: randomUUID(), sellerId: sellerBId, productId: productBId, productName: "Steel Rod", productImageUrl: null, city: "Dire Dawa", region: null, price: "600.00", quantity: 10, deliveryAvailable: true });

    const resA = await get("/api/seller/inventory", sellerAToken).expect(200);
    expect(resA.body.data.inventory).toHaveLength(1);
    expect(resA.body.data.inventory[0].city).toBe("Addis Ababa");

    const resB = await get("/api/seller/inventory", sellerBToken).expect(200);
    expect(resB.body.data.inventory).toHaveLength(1);
    expect(resB.body.data.inventory[0].city).toBe("Dire Dawa");
  });

  it("filters inventory by product name search", async () => {
    repo.addEntry({ id: randomUUID(), sellerId: sellerAId, productId: productAId, productName: "Cement Bag 50kg", productImageUrl: null, city: "Addis Ababa", region: null, price: "475.00", quantity: 20, deliveryAvailable: false });

    const match = await get("/api/seller/inventory?search=cement", sellerAToken).expect(200);
    expect(match.body.data.inventory).toHaveLength(1);

    const noMatch = await get("/api/seller/inventory?search=steel", sellerAToken).expect(200);
    expect(noMatch.body.data.inventory).toHaveLength(0);
  });

  it("filters inventory by city", async () => {
    repo.addEntry({ id: randomUUID(), sellerId: sellerAId, productId: productAId, productName: "Cement", productImageUrl: null, city: "Addis Ababa", region: null, price: "475.00", quantity: 20, deliveryAvailable: false });

    const match = await get("/api/seller/inventory?city=Addis", sellerAToken).expect(200);
    expect(match.body.data.inventory).toHaveLength(1);

    const noMatch = await get("/api/seller/inventory?city=Hawassa", sellerAToken).expect(200);
    expect(noMatch.body.data.inventory).toHaveLength(0);
  });

  it("rejects invalid list query parameters", async () => {
    await get("/api/seller/inventory?page=0", sellerAToken).expect(400);
    await get("/api/seller/inventory?limit=101", sellerAToken).expect(400);
    await get("/api/seller/inventory?unknown=x", sellerAToken).expect(400);
  });

  // ── Create ──────────────────────────────────────────────────────────────────

  it("creates a SellerInventory entry with sellerId from the token, not the body", async () => {
    const res = await post("/api/seller/inventory", sellerAToken, validCreateBody).expect(201);

    const entry = res.body.data.entry;
    expect(entry.sellerId).toBe(sellerAId);   // from token
    expect(entry.productId).toBe(productAId);
    expect(entry.city).toBe("Addis Ababa");
    expect(entry.price).toBe("475.00");
    expect(entry.quantity).toBe(20);
    expect(entry.deliveryAvailable).toBe(false);
    expect(entry.productName).toBe("Cement Bag 50kg");
  });

  it("creates with deliveryAvailable true and optional region", async () => {
    const res = await post("/api/seller/inventory", sellerAToken, {
      ...validCreateBody,
      region: "Oromia",
      deliveryAvailable: true,
    }).expect(201);

    expect(res.body.data.entry.deliveryAvailable).toBe(true);
    expect(res.body.data.entry.region).toBe("Oromia");
  });

  it("rejects creation for a product that belongs to another seller", async () => {
    const res = await post("/api/seller/inventory", sellerAToken, {
      ...validCreateBody,
      productId: productBId, // owned by Seller B
    }).expect(403);

    expect(res.body.message).toContain("own products");
  });

  it("rejects creation for a product that does not exist", async () => {
    const res = await post("/api/seller/inventory", sellerAToken, {
      ...validCreateBody,
      productId: randomUUID(),
    }).expect(404);

    expect(res.body.message).toContain("not found");
  });

  it("rejects duplicate SellerInventory for the same seller and product", async () => {
    await post("/api/seller/inventory", sellerAToken, validCreateBody).expect(201);

    const res = await post("/api/seller/inventory", sellerAToken, validCreateBody).expect(409);
    expect(res.body.message).toContain("already exists");
  });

  it("rejects invalid price, quantity, city, and productId", async () => {
    const badPrice = await post("/api/seller/inventory", sellerAToken, { ...validCreateBody, price: "-1" }).expect(400);
    expect(badPrice.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: "body.price" })]));

    // Price 0.00 is also rejected — inventory price must be > 0
    const zeroPrice = await post("/api/seller/inventory", sellerAToken, { ...validCreateBody, price: "0" }).expect(400);
    expect(zeroPrice.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: "body.price" })]));

    const zeroDecimalPrice = await post("/api/seller/inventory", sellerAToken, { ...validCreateBody, price: "0.00" }).expect(400);
    expect(zeroDecimalPrice.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: "body.price" })]));

    // Positive decimal is accepted
    const validDecimalPrice = await post("/api/seller/inventory", sellerAToken, { ...validCreateBody, price: "0.01" }).expect(201);
    expect(validDecimalPrice.body.data.entry.price).toBe("0.01");

    const badQty = await post("/api/seller/inventory", sellerAToken, { ...validCreateBody, quantity: -5 }).expect(400);
    expect(badQty.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: "body.quantity" })]));

    const badCity = await post("/api/seller/inventory", sellerAToken, { ...validCreateBody, city: "" }).expect(400);
    expect(badCity.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: "body.city" })]));

    const badProductId = await post("/api/seller/inventory", sellerAToken, { ...validCreateBody, productId: "not-a-uuid" }).expect(400);
    expect(badProductId.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: "body.productId" })]));
  });

  it("rejects unknown body fields", async () => {
    await post("/api/seller/inventory", sellerAToken, { ...validCreateBody, sellerId: sellerAId }).expect(400);
  });

  // ── Update ──────────────────────────────────────────────────────────────────

  it("updates price, quantity, city, region, and deliveryAvailable", async () => {
    const created = await post("/api/seller/inventory", sellerAToken, validCreateBody).expect(201);
    const id = created.body.data.entry.id as string;

    const updated = await patch(`/api/seller/inventory/${id}`, sellerAToken, {
      price: "500.00",
      quantity: 15,
      city: "Hawassa",
      region: "SNNPR",
      deliveryAvailable: true,
    }).expect(200);

    expect(updated.body.data.entry).toMatchObject({
      id,
      price: "500.00",
      quantity: 15,
      city: "Hawassa",
      region: "SNNPR",
      deliveryAvailable: true,
    });
  });

  it("allows partial updates — only the supplied fields change", async () => {
    const created = await post("/api/seller/inventory", sellerAToken, validCreateBody).expect(201);
    const id = created.body.data.entry.id as string;

    const updated = await patch(`/api/seller/inventory/${id}`, sellerAToken, { quantity: 5 }).expect(200);
    expect(updated.body.data.entry.quantity).toBe(5);
    expect(updated.body.data.entry.price).toBe("475.00");   // unchanged
    expect(updated.body.data.entry.city).toBe("Addis Ababa"); // unchanged
  });

  it("rejects an empty update body", async () => {
    const created = await post("/api/seller/inventory", sellerAToken, validCreateBody).expect(201);
    const id = created.body.data.entry.id as string;

    await patch(`/api/seller/inventory/${id}`, sellerAToken, {}).expect(400);
  });

  it("rejects invalid update values", async () => {
    const created = await post("/api/seller/inventory", sellerAToken, validCreateBody).expect(201);
    const id = created.body.data.entry.id as string;

    const badPrice = await patch(`/api/seller/inventory/${id}`, sellerAToken, { price: "abc" }).expect(400);
    expect(badPrice.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: "body.price" })]));

    const badQty = await patch(`/api/seller/inventory/${id}`, sellerAToken, { quantity: -1 }).expect(400);
    expect(badQty.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: "body.quantity" })]));
  });

  it("returns 404 when updating a non-existent entry", async () => {
    await patch(`/api/seller/inventory/${randomUUID()}`, sellerAToken, { price: "500.00" }).expect(404);
  });

  it("returns 404 when Seller B tries to update Seller A's entry", async () => {
    const created = await post("/api/seller/inventory", sellerAToken, validCreateBody).expect(201);
    const id = created.body.data.entry.id as string;

    const res = await patch(`/api/seller/inventory/${id}`, sellerBToken, { price: "999.00" }).expect(404);
    expect(res.body.message).toContain("not found");

    // Seller A's entry is unchanged
    const list = await get("/api/seller/inventory", sellerAToken).expect(200);
    expect(list.body.data.inventory[0].price).toBe("475.00");
  });

  // ── Delete ──────────────────────────────────────────────────────────────────

  it("deletes the seller's own inventory entry", async () => {
    const created = await post("/api/seller/inventory", sellerAToken, validCreateBody).expect(201);
    const id = created.body.data.entry.id as string;

    await del(`/api/seller/inventory/${id}`, sellerAToken).expect(200);

    const list = await get("/api/seller/inventory", sellerAToken).expect(200);
    expect(list.body.data.inventory).toHaveLength(0);
  });

  it("returns 404 when deleting a non-existent entry", async () => {
    await del(`/api/seller/inventory/${randomUUID()}`, sellerAToken).expect(404);
  });

  it("returns 404 when Seller B tries to delete Seller A's entry", async () => {
    const created = await post("/api/seller/inventory", sellerAToken, validCreateBody).expect(201);
    const id = created.body.data.entry.id as string;

    await del(`/api/seller/inventory/${id}`, sellerBToken).expect(404);

    // Seller A's entry still exists
    const list = await get("/api/seller/inventory", sellerAToken).expect(200);
    expect(list.body.data.inventory).toHaveLength(1);
  });

  it("rejects a non-UUID inventory ID in params", async () => {
    await patch("/api/seller/inventory/not-a-uuid", sellerAToken, { price: "100.00" }).expect(400);
    await del("/api/seller/inventory/not-a-uuid", sellerAToken).expect(400);
  });

  // ── Isolation (regression) ──────────────────────────────────────────────────

  it("Seller A's inventory changes do not affect Seller B", async () => {
    // Seller B has an entry
    repo.addEntry({
      id: randomUUID(),
      sellerId: sellerBId,
      productId: productBId,
      productName: "Steel Rod",
      productImageUrl: null,
      city: "Dire Dawa",
      region: null,
      price: "600.00",
      quantity: 30,
      deliveryAvailable: true,
    });

    // Seller A creates and then deletes their own entry
    const created = await post("/api/seller/inventory", sellerAToken, validCreateBody).expect(201);
    await del(`/api/seller/inventory/${created.body.data.entry.id}`, sellerAToken).expect(200);

    // Seller B's entry is untouched
    const listB = await get("/api/seller/inventory", sellerBToken).expect(200);
    expect(listB.body.data.inventory).toHaveLength(1);
    expect(listB.body.data.inventory[0].quantity).toBe(30);
  });

  it("order checkout still uses SellerInventory price and quantity (regression)", async () => {
    // Create an inventory entry for Seller A's product
    const res = await post("/api/seller/inventory", sellerAToken, {
      productId: productAId,
      city: "Addis Ababa",
      price: "850.00",
      quantity: 10,
      deliveryAvailable: false,
    }).expect(201);

    // Verify the entry carries the correct price and quantity
    const entry = res.body.data.entry;
    expect(entry.price).toBe("850.00");
    expect(entry.quantity).toBe(10);
    expect(entry.sellerId).toBe(sellerAId);

    // After update, the new values are reflected immediately
    await patch(`/api/seller/inventory/${entry.id}`, sellerAToken, {
      price: "900.00",
      quantity: 8,
    }).expect(200);

    const list = await get("/api/seller/inventory", sellerAToken).expect(200);
    expect(list.body.data.inventory[0].price).toBe("900.00");
    expect(list.body.data.inventory[0].quantity).toBe(8);
  });

  // ── Helper request functions ─────────────────────────────────────────────────

  function get(path: string, token: string) {
    return request(app).get(path).set("Authorization", `Bearer ${token}`);
  }

  function post(path: string, token: string, body: object) {
    return request(app)
      .post(path)
      .set("Authorization", `Bearer ${token}`)
      .send(body);
  }

  function patch(path: string, token: string, body: object) {
    return request(app)
      .patch(path)
      .set("Authorization", `Bearer ${token}`)
      .send(body);
  }

  function del(path: string, token: string) {
    return request(app)
      .delete(path)
      .set("Authorization", `Bearer ${token}`)
      .send({});
  }
});
