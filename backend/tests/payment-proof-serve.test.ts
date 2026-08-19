/**
 * Tests for the authenticated payment-proof serving endpoint.
 *
 * GET /api/payments/proof/:filename
 *
 * Covers:
 *  1. Unauthenticated request → 401
 *  2. Authenticated but unrelated CUSTOMER → 403
 *  3. Authenticated but unrelated SELLER → 403
 *  4. Owning CUSTOMER → 200 (file streamed)
 *  5. Owning SELLER → 200 (file streamed)
 *  6. ADMIN → 200 (file streamed)
 *  7. Non-existent filename → 404
 *  8. Path traversal attempt → rejected (400 or 404)
 *  9. Old public URL /uploads/payment-proofs/<filename> → 404
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import pino from "pino";
import request from "supertest";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { createApp } from "../src/app.js";
import type {
  PaymentProofStorage,
  ProofFileBuffer,
  SavePaymentProofInput,
  StoredPaymentProof,
} from "../src/services/payment-proof-storage.js";
import { JwtTokenService } from "../src/services/token.service.js";
import type { ManualPaymentMethod } from "../src/types/payment.js";
import { InMemoryOrderRepository } from "./helpers/in-memory-order.repository.js";
import { InMemoryPaymentRepository } from "./helpers/in-memory-payment.repository.js";
import { InMemorySellerPaymentRepository } from "./helpers/in-memory-seller-payment.repository.js";
import { InMemoryUserRepository } from "./helpers/in-memory-user.repository.js";

// ── Fixed IDs ────────────────────────────────────────────────────────────────

const owningCustomerId = randomUUID();
const unrelatedCustomerId = randomUUID();
const owningSellerUserId = randomUUID(); // the seller who owns the product
const unrelatedSellerUserId = randomUUID();
const adminUserId = randomUUID();
const productId = randomUUID();

const shipping = {
  fullName: "Proof Test Customer",
  phone: "+251911111111",
  city: "Addis Ababa",
  address: "Test Road",
  notes: "",
};

// Minimal valid PNG magic bytes
const validPng = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);

// ── Deterministic storage stub ────────────────────────────────────────────────
// Stores a real file in the temp dir so sendFile() works.

class DeterministicProofStorage implements PaymentProofStorage {
  constructor(private readonly dir: string) {}

  async save(input: SavePaymentProofInput): Promise<StoredPaymentProof> {
    const filename = `${input.orderId}.png`;
    const filePath = path.join(this.dir, filename);
    await writeFile(filePath, validPng);
    return { path: filePath, filename };
  }

  async remove(_proof: StoredPaymentProof): Promise<void> {
    // no-op for tests
  }

  async fetch(filename: string): Promise<ProofFileBuffer | null> {
    const filePath = path.join(this.dir, filename);
    try {
      const { readFile } = await import("node:fs/promises");
      const buffer = await readFile(filePath);
      return { buffer, contentType: "image/png" };
    } catch {
      return null;
    }
  }
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe("GET /api/payments/proof/:filename", () => {
  const tokenService = new JwtTokenService();
  let app: ReturnType<typeof createApp>;
  let proofDir: string;
  let storedFilename: string;

  // Tokens
  let owningCustomerToken: string;
  let unrelatedCustomerToken: string;
  let owningSellerToken: string;
  let unrelatedSellerToken: string;
  let adminToken: string;

  beforeEach(async () => {
    // Create a fresh temp directory for each test
    proofDir = path.join(os.tmpdir(), `cmm-proof-test-${randomUUID()}`);
    await mkdir(proofDir, { recursive: true });

    // Repositories
    const orders = new InMemoryOrderRepository();
    orders.addCustomer({
      id: owningCustomerId,
      name: "Owning Customer",
      email: "owner@example.com",
    });
    orders.addCustomer({
      id: unrelatedCustomerId,
      name: "Unrelated Customer",
      email: "unrelated@example.com",
    });
    orders.addProduct({
      id: productId,
      sellerId: owningSellerUserId,
      name: "Cement",
      imageUrl: null,
      price: "100.00",
      quantity: 50,
    });

    const users = new InMemoryUserRepository();
    users.addUser({ id: owningCustomerId, role: "CUSTOMER" });
    users.addUser({ id: unrelatedCustomerId, role: "CUSTOMER" });
    users.addUser({ id: owningSellerUserId, role: "SELLER" });
    users.addUser({ id: unrelatedSellerUserId, role: "SELLER" });
    users.addUser({ id: adminUserId, role: "ADMIN" });

    const sellerPayments = new InMemorySellerPaymentRepository();
    sellerPayments.addProduct(productId, owningSellerUserId);
    sellerPayments.addProfile({
      sellerId: owningSellerUserId,
      sellerName: "Owning Seller",
      sellerPhone: "+251911000222",
      destinations: [
        {
          method: "CBE_BANK",
          providerName: "CBE Bank",
          accountName: "CMM Marketplace",
          accountNumber: "1000123456789",
          accountNumberLabel: "Account number",
        },
      ],
    });

    const proofStorage = new DeterministicProofStorage(proofDir);
    const paymentRepository = new InMemoryPaymentRepository(orders);

    app = createApp({
      userRepository: users,
      orderRepository: orders,
      paymentRepository,
      paymentProofStorage: proofStorage,
      sellerPaymentRepository: sellerPayments,
      tokenService,
      logger: pino({ level: "silent" }),
    });

    // Create an order and submit a proof, so there's something to serve
    owningCustomerToken = tokenService.createAccessToken({
      userId: owningCustomerId,
      role: "CUSTOMER",
    });
    unrelatedCustomerToken = tokenService.createAccessToken({
      userId: unrelatedCustomerId,
      role: "CUSTOMER",
    });
    owningSellerToken = tokenService.createAccessToken({
      userId: owningSellerUserId,
      role: "SELLER",
    });
    unrelatedSellerToken = tokenService.createAccessToken({
      userId: unrelatedSellerUserId,
      role: "SELLER",
    });
    adminToken = tokenService.createAccessToken({
      userId: adminUserId,
      role: "ADMIN",
    });

    // Place order and submit proof
    const orderId = await createOrder(app, owningCustomerToken, productId, owningSellerUserId, shipping);
    await submitProof(app, owningCustomerToken, orderId);

    // The deterministic storage writes `${orderId}.png`
    storedFilename = `${orderId}.png`;
  });

  afterEach(async () => {
    await rm(proofDir, { recursive: true, force: true });
  });

  // ── 1. Unauthenticated ───────────────────────────────────────────────────

  it("returns 401 for unauthenticated requests", async () => {
    await request(app)
      .get(`/api/payments/proof/${storedFilename}`)
      .expect(401);
  });

  // ── 2. Unrelated CUSTOMER ────────────────────────────────────────────────

  it("returns 403 for a CUSTOMER who does not own the order", async () => {
    await request(app)
      .get(`/api/payments/proof/${storedFilename}`)
      .set("Authorization", `Bearer ${unrelatedCustomerToken}`)
      .expect(403);
  });

  // ── 3. Unrelated SELLER ──────────────────────────────────────────────────

  it("returns 403 for a SELLER not associated with the order", async () => {
    await request(app)
      .get(`/api/payments/proof/${storedFilename}`)
      .set("Authorization", `Bearer ${unrelatedSellerToken}`)
      .expect(403);
  });

  // ── 4. Owning CUSTOMER ───────────────────────────────────────────────────

  it("returns 200 and the proof image for the owning CUSTOMER", async () => {
    const response = await request(app)
      .get(`/api/payments/proof/${storedFilename}`)
      .set("Authorization", `Bearer ${owningCustomerToken}`)
      .expect(200);

    expect(response.body).toBeInstanceOf(Buffer);
    expect(response.body.slice(0, 4)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    );
  });

  // ── 5. Owning SELLER ─────────────────────────────────────────────────────

  it("returns 200 and the proof image for the owning SELLER", async () => {
    const response = await request(app)
      .get(`/api/payments/proof/${storedFilename}`)
      .set("Authorization", `Bearer ${owningSellerToken}`)
      .buffer(true)
      .expect(200);

    expect(response.body.slice(0, 4)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    );
  });

  // ── 6. ADMIN ─────────────────────────────────────────────────────────────

  it("returns 200 and the proof image for an ADMIN", async () => {
    const response = await request(app)
      .get(`/api/payments/proof/${storedFilename}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .buffer(true)
      .expect(200);

    expect(response.body.slice(0, 4)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    );
  });

  // ── 7. Non-existent filename ─────────────────────────────────────────────

  it("returns 404 for a filename not found in the database", async () => {
    await request(app)
      .get(`/api/payments/proof/nonexistent-${randomUUID()}.png`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(404);
  });

  // ── 8. Path traversal ────────────────────────────────────────────────────

  it("rejects a path traversal attempt via URL encoding", async () => {
    // ..%2F or ../ in the filename should result in 400 (validator rejects) or 404
    const response = await request(app)
      .get("/api/payments/proof/..%2F..%2Fetc%2Fpasswd")
      .set("Authorization", `Bearer ${adminToken}`);

    expect([400, 404]).toContain(response.status);
  });

  it("rejects a filename with directory separators", async () => {
    const response = await request(app)
      .get("/api/payments/proof/subdir%2Ffile.png")
      .set("Authorization", `Bearer ${adminToken}`);

    expect([400, 404]).toContain(response.status);
  });

  it("rejects a filename with dot-dot sequences", async () => {
    const response = await request(app)
      .get("/api/payments/proof/....png")
      .set("Authorization", `Bearer ${adminToken}`);

    // This particular filename is allowed by the regex (no slashes, no ..) but
    // won't exist in the DB, so it should 404.
    expect([400, 404]).toContain(response.status);
  });

  // ── 9. Old public URL no longer accessible ───────────────────────────────

  it("no longer serves files at the old public /uploads/payment-proofs path", async () => {
    // This route was removed — Express should return 404 (not-found handler)
    const response = await request(app)
      .get(`/uploads/payment-proofs/${storedFilename}`);

    expect(response.status).toBe(404);
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createOrder(
  app: ReturnType<typeof createApp>,
  customerToken: string,
  pId: string,
  sId: string,
  shippingData: typeof shipping,
): Promise<string> {
  const response = await request(app)
    .post("/api/orders")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({
      items: [{ productId: pId, sellerId: sId, quantity: 1 }],
      shipping: shippingData,
      paymentMethod: "CBE_BANK" as ManualPaymentMethod,
    })
    .expect(201);

  return response.body.data.order.id as string;
}

function submitProof(
  app: ReturnType<typeof createApp>,
  customerToken: string,
  orderId: string,
) {
  return request(app)
    .post("/api/payments/manual")
    .set("Authorization", `Bearer ${customerToken}`)
    .field("orderId", orderId)
    .attach("proof", validPng, {
      filename: "proof.png",
      contentType: "image/png",
    });
}
