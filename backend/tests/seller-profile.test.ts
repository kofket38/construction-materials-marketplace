import { randomUUID } from "node:crypto";
import pino from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { JwtTokenService } from "../src/services/token.service.js";
import { InMemorySellerProfileRepository } from "./helpers/in-memory-seller-profile.repository.js";
import { InMemoryUserRepository } from "./helpers/in-memory-user.repository.js";

// ── Fixed IDs ──────────────────────────────────────────────────────────────────

const sellerAId = randomUUID();
const sellerBId = randomUUID();
const customerId = randomUUID();
const adminId = randomUUID();

const validUpsertBody = {
  shopName: "Addis Construction Supplies",
  phone: "+251911234567",
  address: "Bole Road, Addis Ababa",
  paymentAccountName: "Addis Construction Supplies",
  telebirrNumber: "0911234567",
  cbeBirrNumber: null,
  cbeBankAccountNumber: "1000123456789",
  awashBankAccountNumber: null,
  dashenBankAccountNumber: null,
  eBirrNumber: null,
};

// ─────────────────────────────────────────────────────────────────────────────

describe("Seller Profile API", () => {
  const tokenService = new JwtTokenService();
  let profiles: InMemorySellerProfileRepository;
  let users: InMemoryUserRepository;
  let app: ReturnType<typeof createApp>;
  let sellerAToken: string;
  let sellerBToken: string;
  let customerToken: string;
  let adminToken: string;

  beforeEach(() => {
    profiles = new InMemorySellerProfileRepository();
    users = new InMemoryUserRepository();

    users.addUser({ id: sellerAId, role: "SELLER" });
    users.addUser({ id: sellerBId, role: "SELLER" });
    users.addUser({ id: customerId, role: "CUSTOMER" });
    users.addUser({ id: adminId, role: "ADMIN" });

    app = createApp({
      userRepository: users,
      sellerProfileRepository: profiles,
      tokenService,
      logger: pino({ level: "silent" }),
    });

    sellerAToken = tokenService.createAccessToken({ userId: sellerAId, role: "SELLER" });
    sellerBToken = tokenService.createAccessToken({ userId: sellerBId, role: "SELLER" });
    customerToken = tokenService.createAccessToken({ userId: customerId, role: "CUSTOMER" });
    adminToken = tokenService.createAccessToken({ userId: adminId, role: "ADMIN" });
  });

  // ── Authentication & authorization ──────────────────────────────────────────

  it("requires authentication for every profile endpoint", async () => {
    await request(app).get("/api/seller/profile").expect(401);
    await request(app).put("/api/seller/profile").expect(401);
    await request(app).patch("/api/seller/profile").expect(401);
  });

  it("rejects customer access to profile endpoints", async () => {
    await get("/api/seller/profile", customerToken).expect(403);
    await put("/api/seller/profile", customerToken, validUpsertBody).expect(403);
    await patch("/api/seller/profile", customerToken, { shopName: "X" }).expect(403);
  });

  it("rejects admin access to profile endpoints", async () => {
    await get("/api/seller/profile", adminToken).expect(403);
    await put("/api/seller/profile", adminToken, validUpsertBody).expect(403);
    await patch("/api/seller/profile", adminToken, { shopName: "X" }).expect(403);
  });

  // ── GET ─────────────────────────────────────────────────────────────────────

  it("returns null when the seller has no profile yet", async () => {
    const res = await get("/api/seller/profile", sellerAToken).expect(200);
    expect(res.body.data.profile).toBeNull();
  });

  it("returns only the authenticated seller's own profile", async () => {
    profiles.addProfile(sellerAId, { shopName: "Seller A Shop" });
    profiles.addProfile(sellerBId, { shopName: "Seller B Shop" });

    const resA = await get("/api/seller/profile", sellerAToken).expect(200);
    expect(resA.body.data.profile.shopName).toBe("Seller A Shop");
    expect(resA.body.data.profile.userId).toBe(sellerAId);

    const resB = await get("/api/seller/profile", sellerBToken).expect(200);
    expect(resB.body.data.profile.shopName).toBe("Seller B Shop");
    expect(resB.body.data.profile.userId).toBe(sellerBId);
  });

  // ── PUT (upsert) ────────────────────────────────────────────────────────────

  it("creates a profile when none exists", async () => {
    const res = await put("/api/seller/profile", sellerAToken, validUpsertBody).expect(200);

    const profile = res.body.data.profile;
    expect(profile.userId).toBe(sellerAId);
    expect(profile.shopName).toBe("Addis Construction Supplies");
    expect(profile.phone).toBe("+251911234567");
    expect(profile.address).toBe("Bole Road, Addis Ababa");
    expect(profile.telebirrNumber).toBe("0911234567");
    expect(profile.cbeBankAccountNumber).toBe("1000123456789");
    expect(profile.cbeBirrNumber).toBeNull();
  });

  it("updates an existing profile (upsert replaces all fields)", async () => {
    profiles.addProfile(sellerAId, {
      shopName: "Old Shop",
      telebirrNumber: "0900000000",
    });

    const updated = await put("/api/seller/profile", sellerAToken, {
      ...validUpsertBody,
      shopName: "New Shop Name",
      telebirrNumber: null,
    }).expect(200);

    expect(updated.body.data.profile.shopName).toBe("New Shop Name");
    expect(updated.body.data.profile.telebirrNumber).toBeNull();
  });

  it("seller A upsert does not affect seller B profile", async () => {
    profiles.addProfile(sellerBId, { shopName: "Seller B unchanged" });

    await put("/api/seller/profile", sellerAToken, validUpsertBody).expect(200);

    const resB = await get("/api/seller/profile", sellerBToken).expect(200);
    expect(resB.body.data.profile.shopName).toBe("Seller B unchanged");
  });

  it("sellerId comes from JWT — cannot be overridden in body", async () => {
    const bodyWithForeignId = {
      ...validUpsertBody,
      userId: sellerBId, // should be ignored / rejected by strict schema
    };
    const res = await put("/api/seller/profile", sellerAToken, bodyWithForeignId).expect(400);
    expect(res.body.message).toBe("Request validation failed.");
  });

  it("trims whitespace from shopName, phone, and address", async () => {
    const res = await put("/api/seller/profile", sellerAToken, {
      ...validUpsertBody,
      shopName: "  Trimmed Shop  ",
      phone: "  +251900000000  ",
      address: "  Bole  ",
    }).expect(200);

    expect(res.body.data.profile.shopName).toBe("Trimmed Shop");
    expect(res.body.data.profile.phone).toBe("+251900000000");
    expect(res.body.data.profile.address).toBe("Bole");
  });

  it("treats empty-string payment fields as null", async () => {
    const res = await put("/api/seller/profile", sellerAToken, {
      ...validUpsertBody,
      telebirrNumber: "",
      cbeBankAccountNumber: "",
    }).expect(200);

    expect(res.body.data.profile.telebirrNumber).toBeNull();
    expect(res.body.data.profile.cbeBankAccountNumber).toBeNull();
  });

  it("rejects missing required fields", async () => {
    const noShopName = await put("/api/seller/profile", sellerAToken, {
      ...validUpsertBody,
      shopName: "",
    }).expect(400);
    expect(noShopName.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "body.shopName" })]),
    );

    const noPhone = await put("/api/seller/profile", sellerAToken, {
      ...validUpsertBody,
      phone: "",
    }).expect(400);
    expect(noPhone.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "body.phone" })]),
    );

    const noAddress = await put("/api/seller/profile", sellerAToken, {
      ...validUpsertBody,
      address: "",
    }).expect(400);
    expect(noAddress.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "body.address" })]),
    );
  });

  it("rejects unknown fields in upsert body", async () => {
    await put("/api/seller/profile", sellerAToken, {
      ...validUpsertBody,
      unknownField: "bad",
    }).expect(400);
  });

  // ── PATCH (partial update) ──────────────────────────────────────────────────

  it("updates only the supplied fields", async () => {
    profiles.addProfile(sellerAId, {
      shopName: "Original Shop",
      phone: "+251900000001",
      address: "Original Address",
      telebirrNumber: "0900000001",
    });

    const res = await patch("/api/seller/profile", sellerAToken, {
      shopName: "Updated Shop",
      telebirrNumber: "0911111111",
    }).expect(200);

    expect(res.body.data.profile.shopName).toBe("Updated Shop");
    expect(res.body.data.profile.telebirrNumber).toBe("0911111111");
    // Unchanged fields preserved
    expect(res.body.data.profile.phone).toBe("+251900000001");
    expect(res.body.data.profile.address).toBe("Original Address");
  });

  it("returns 404 when patching a non-existent profile", async () => {
    const res = await patch("/api/seller/profile", sellerAToken, {
      shopName: "Shop",
    }).expect(404);
    expect(res.body.message).toContain("not found");
  });

  it("rejects an empty PATCH body", async () => {
    profiles.addProfile(sellerAId);
    await patch("/api/seller/profile", sellerAToken, {}).expect(400);
  });

  it("allows clearing a payment field to null via PATCH", async () => {
    profiles.addProfile(sellerAId, { telebirrNumber: "0911111111" });

    const res = await patch("/api/seller/profile", sellerAToken, {
      telebirrNumber: null,
    }).expect(200);

    expect(res.body.data.profile.telebirrNumber).toBeNull();
  });

  it("rejects unknown fields in PATCH body", async () => {
    profiles.addProfile(sellerAId);
    await patch("/api/seller/profile", sellerAToken, {
      shopName: "OK",
      illegal: "field",
    }).expect(400);
  });

  it("seller B cannot read or mutate seller A profile (own-scope isolation)", async () => {
    profiles.addProfile(sellerAId, { shopName: "A Shop" });

    // Both sellers have their own profile endpoint scoped to JWT userId,
    // so seller B just reads their own (empty) profile, not seller A's.
    const resB = await get("/api/seller/profile", sellerBToken).expect(200);
    expect(resB.body.data.profile).toBeNull(); // Seller B has no profile

    // Seller B PATCH returns 404 (their own profile doesn't exist)
    const patchRes = await patch("/api/seller/profile", sellerBToken, {
      shopName: "Hacker",
    }).expect(404);
    expect(patchRes.body.message).toContain("not found");

    // Seller A profile is untouched
    const resA = await get("/api/seller/profile", sellerAToken).expect(200);
    expect(resA.body.data.profile.shopName).toBe("A Shop");
  });

  // ── Helper request functions ─────────────────────────────────────────────────

  function get(path: string, token: string) {
    return request(app).get(path).set("Authorization", `Bearer ${token}`);
  }

  function put(path: string, token: string, body: object) {
    return request(app)
      .put(path)
      .set("Authorization", `Bearer ${token}`)
      .send(body);
  }

  function patch(path: string, token: string, body: object) {
    return request(app)
      .patch(path)
      .set("Authorization", `Bearer ${token}`)
      .send(body);
  }
});
