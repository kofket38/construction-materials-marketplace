import { randomUUID } from "node:crypto";
import pino from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type {
  PaymentProofStorage,
  SavePaymentProofInput,
  StoredPaymentProof,
} from "../src/services/payment-proof-storage.js";
import { JwtTokenService } from "../src/services/token.service.js";
import type { ManualPaymentMethod } from "../src/types/payment.js";
import { InMemoryOrderRepository } from "./helpers/in-memory-order.repository.js";
import { InMemoryPaymentRepository } from "./helpers/in-memory-payment.repository.js";
import { InMemorySellerPaymentRepository } from "./helpers/in-memory-seller-payment.repository.js";
import { InMemoryUserRepository } from "./helpers/in-memory-user.repository.js";

const customerId = randomUUID();
const otherCustomerId = randomUUID();
const sellerId = randomUUID();
const productId = randomUUID();
const shipping = {
  fullName: "Payment Customer",
  phone: "+251911000000",
  city: "Addis Ababa",
  address: "Bole Road",
  notes: "",
};
const manualPaymentConfiguration = [
  {
    method: "TELEBIRR",
    providerName: "Telebirr",
    accountName: "CMM Marketplace",
    accountNumber: "0911000000",
    accountNumberLabel: "Payment number",
  },
  {
    method: "CBE_BIRR",
    providerName: "CBE Birr",
    accountName: "CMM Marketplace",
    accountNumber: "0911000001",
    accountNumberLabel: "Payment number",
  },
  {
    method: "CBE_BANK",
    providerName: "CBE Bank",
    accountName: "CMM Marketplace",
    accountNumber: "1000123456789",
    accountNumberLabel: "Account number",
  },
  {
    method: "AWASH_BANK",
    providerName: "Awash Bank",
    accountName: "CMM Marketplace",
    accountNumber: "0134012345678",
    accountNumberLabel: "Account number",
  },
  {
    method: "DASHEN_BANK",
    providerName: "Dashen Bank",
    accountName: "CMM Marketplace",
    accountNumber: "1800123456789",
    accountNumberLabel: "Account number",
  },
  {
    method: "E_BIRR",
    providerName: "E-birr",
    accountName: "CMM Marketplace",
    accountNumber: "0911000003",
    accountNumberLabel: "Payment number",
  },
] as const;
const validPng = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);

class InMemoryPaymentProofStorage implements PaymentProofStorage {
  saved: SavePaymentProofInput[] = [];
  removed: StoredPaymentProof[] = [];

  async save(input: SavePaymentProofInput): Promise<StoredPaymentProof> {
    this.saved.push(input);
    return {
      path: `memory://${input.orderId}`,
      url: `/uploads/payment-proofs/${input.orderId}.png`,
    };
  }

  async remove(storedProof: StoredPaymentProof): Promise<void> {
    this.removed.push(storedProof);
  }
}

describe("Payment API", () => {
  const tokenService = new JwtTokenService();
  let app: ReturnType<typeof createApp>;
  let orders: InMemoryOrderRepository;
  let proofStorage: InMemoryPaymentProofStorage;
  let customerToken: string;
  let otherCustomerToken: string;

  beforeEach(() => {
    orders = new InMemoryOrderRepository();
    orders.addCustomer({
      id: customerId,
      name: "Payment Customer",
      email: "payment@example.com",
    });
    orders.addCustomer({
      id: otherCustomerId,
      name: "Other Customer",
      email: "other@example.com",
    });
    orders.addProduct({
      id: productId,
      sellerId,
      name: "Cement",
      imageUrl: null,
      price: "100.00",
      quantity: 20,
    });

    const users = new InMemoryUserRepository();
    users.addUser({ id: customerId, role: "CUSTOMER" });
    users.addUser({ id: otherCustomerId, role: "CUSTOMER" });

    proofStorage = new InMemoryPaymentProofStorage();
    const sellerPayments = new InMemorySellerPaymentRepository();
    sellerPayments.addProduct(productId, sellerId);
    sellerPayments.addProfile({
      sellerId,
      sellerName: "Cement Seller",
      sellerPhone: "+251911000111",
      destinations: [...manualPaymentConfiguration],
    });
    app = createApp({
      userRepository: users,
      orderRepository: orders,
      paymentRepository: new InMemoryPaymentRepository(orders),
      paymentProofStorage: proofStorage,
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
  });

  it.each(manualPaymentConfiguration)(
    "submits $method proof and moves the order to verification",
    async (destination) => {
      const orderId = await createOrder(destination.method);

      const response = await submitProof(orderId).expect(201);

      expect(response.body.data.payment).toMatchObject({
        orderId,
        method: destination.method,
        providerName: destination.providerName,
        status: "PENDING_VERIFICATION",
        verifiedAt: null,
      });
      expect(response.body.data.payment.proofImageUrl).toContain(orderId);
      expect((await orders.findById(orderId))?.status).toBe(
        "PENDING_PAYMENT_VERIFICATION",
      );
      expect(proofStorage.saved).toHaveLength(1);
      expect(orders.getProductQuantity(productId)).toBe(19);
    },
  );

  it("returns the selected seller's checkout payment options", async () => {
    const response = await request(app)
      .post("/api/payments/options")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ productIds: [productId] })
      .expect(200);

    expect(response.body.data).toEqual({
      seller: {
        id: sellerId,
        name: "Cement Seller",
        phone: "+251911000111",
      },
      paymentDestinations: manualPaymentConfiguration,
    });
  });

  it("returns manual payment details only to the order owner", async () => {
    const destination = manualPaymentConfiguration[1];
    const orderId = await createOrder(destination.method);
    await submitProof(orderId).expect(201);

    const response = await request(app)
      .get(`/api/payments/${orderId}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(200);

    expect(response.body.data).toMatchObject({
      order: {
        id: orderId,
        status: "PENDING_PAYMENT_VERIFICATION",
        paymentMethod: destination.method,
      },
      payment: {
        orderId,
        method: destination.method,
        providerName: destination.providerName,
        status: "PENDING_VERIFICATION",
      },
      paymentDestination: destination,
    });

    await request(app)
      .get(`/api/payments/${orderId}`)
      .set("Authorization", `Bearer ${otherCustomerToken}`)
      .expect(403);
  });

  it("requires a payment screenshot", async () => {
    const orderId = await createOrder("TELEBIRR");

    const response = await request(app)
      .post("/api/payments/manual")
      .set("Authorization", `Bearer ${customerToken}`)
      .field("orderId", orderId)
      .expect(400);

    expect(response.body.errors).toContainEqual({
      field: "body.proof",
      message: "Upload a payment screenshot.",
    });
  });

  it("rejects files whose content does not match an accepted image", async () => {
    const orderId = await createOrder("CBE_BIRR");

    const response = await request(app)
      .post("/api/payments/manual")
      .set("Authorization", `Bearer ${customerToken}`)
      .field("orderId", orderId)
      .attach("proof", Buffer.from("not an image"), {
        filename: "proof.png",
        contentType: "image/png",
      })
      .expect(400);

    expect(response.body.errors).toContainEqual({
      field: "body.proof",
      message: "Upload a valid JPEG, PNG, or WebP image.",
    });
  });

  it("rejects payment submission for another customer's order", async () => {
    const orderId = await createOrder("AWASH_BANK");

    await request(app)
      .post("/api/payments/manual")
      .set("Authorization", `Bearer ${otherCustomerToken}`)
      .field("orderId", orderId)
      .attach("proof", validPng, {
        filename: "proof.png",
        contentType: "image/png",
      })
      .expect(403);

    expect(proofStorage.saved).toHaveLength(0);
  });

  it("rejects payment proof for cash on delivery orders", async () => {
    const orderId = await createOrder("CASH_ON_DELIVERY");

    const response = await submitProof(orderId).expect(400);

    expect(response.body.message).toBe(
      "This order does not require manual payment proof.",
    );
  });

  it("prevents duplicate payment proof submission", async () => {
    const orderId = await createOrder("DASHEN_BANK");
    await submitProof(orderId).expect(201);

    const response = await submitProof(orderId).expect(409);

    expect(response.body.message).toBe(
      "Payment proof has already been submitted for this order.",
    );
    expect(proofStorage.saved).toHaveLength(1);
  });

  async function createOrder(
    paymentMethod: "CASH_ON_DELIVERY" | ManualPaymentMethod,
  ): Promise<string> {
    const response = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        items: [{ productId, quantity: 1 }],
        shipping,
        paymentMethod,
      })
      .expect(201);

    return response.body.data.order.id as string;
  }

  function submitProof(orderId: string) {
    return request(app)
      .post("/api/payments/manual")
      .set("Authorization", `Bearer ${customerToken}`)
      .field("orderId", orderId)
      .attach("proof", validPng, {
        filename: "proof.png",
        contentType: "image/png",
      });
  }
});
