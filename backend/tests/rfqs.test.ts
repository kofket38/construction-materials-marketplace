import { randomUUID } from "node:crypto";
import pino from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { JwtTokenService } from "../src/services/token.service.js";
import { InMemoryRfqRepository } from "./helpers/in-memory-rfq.repository.js";
import { InMemoryUserRepository } from "./helpers/in-memory-user.repository.js";

const cementCategoryId = randomUUID();
const steelCategoryId = randomUUID();
const customerId = randomUUID();
const otherCustomerId = randomUUID();
const sellerId = randomUUID();
const secondSellerId = randomUUID();
const ineligibleSellerId = randomUUID();
const adminId = randomUUID();
const sellerCementId = randomUUID();
const sellerSteelId = randomUUID();
const secondSellerCementId = randomUUID();
const secondSellerSteelId = randomUUID();
const ineligibleCementId = randomUUID();

describe("RFQ API", () => {
  const tokenService = new JwtTokenService();
  let app: ReturnType<typeof createApp>;
  let rfqs: InMemoryRfqRepository;
  let customerToken: string;
  let otherCustomerToken: string;
  let sellerToken: string;
  let secondSellerToken: string;
  let ineligibleSellerToken: string;
  let adminToken: string;

  beforeEach(() => {
    rfqs = new InMemoryRfqRepository();
    rfqs.addCategory({ id: cementCategoryId, name: "Cement" });
    rfqs.addCategory({ id: steelCategoryId, name: "Steel" });
    rfqs.addCustomer({
      id: customerId,
      name: "Primary Customer",
      company: "Primary Builders",
      email: "primary@example.com",
    });
    rfqs.addCustomer({
      id: otherCustomerId,
      name: "Other Customer",
      company: null,
      email: "other@example.com",
    });
    rfqs.addSeller({
      id: sellerId,
      name: "First Seller",
      company: "First Supplies",
      shopName: "First Materials",
    });
    rfqs.addSeller({
      id: secondSellerId,
      name: "Second Seller",
      company: "Second Supplies",
      shopName: "Second Materials",
    });
    rfqs.addSeller({
      id: ineligibleSellerId,
      name: "Cement Only Seller",
      company: null,
      shopName: "Cement Only",
    });
    addProduct(sellerCementId, sellerId, cementCategoryId, "Cement A", 100);
    addProduct(sellerSteelId, sellerId, steelCategoryId, "Steel A", 50);
    addProduct(
      secondSellerCementId,
      secondSellerId,
      cementCategoryId,
      "Cement B",
      100,
    );
    addProduct(
      secondSellerSteelId,
      secondSellerId,
      steelCategoryId,
      "Steel B",
      50,
    );
    addProduct(
      ineligibleCementId,
      ineligibleSellerId,
      cementCategoryId,
      "Cement Only",
      100,
    );

    const users = new InMemoryUserRepository();
    users.addUser({ id: customerId, name: "Primary Customer", role: "CUSTOMER" });
    users.addUser({ id: otherCustomerId, name: "Other Customer", role: "CUSTOMER" });
    users.addUser({ id: sellerId, name: "First Seller", role: "SELLER" });
    users.addUser({ id: secondSellerId, name: "Second Seller", role: "SELLER" });
    users.addUser({ id: ineligibleSellerId, name: "Cement Only", role: "SELLER" });
    users.addUser({ id: adminId, name: "Admin User", role: "ADMIN" });

    app = createApp({
      userRepository: users,
      rfqRepository: rfqs,
      tokenService,
      logger: pino({ level: "silent" }),
    });

    customerToken = token(customerId, "CUSTOMER");
    otherCustomerToken = token(otherCustomerId, "CUSTOMER");
    sellerToken = token(sellerId, "SELLER");
    secondSellerToken = token(secondSellerId, "SELLER");
    ineligibleSellerToken = token(ineligibleSellerId, "SELLER");
    adminToken = token(adminId, "ADMIN");
  });

  it("supports the customer RFQ create, update, list, and cancel lifecycle", async () => {
    const created = await createRfq(customerToken);
    const rfqId = created.body.data.rfq.id as string;

    const updated = await request(app)
      .put(`/api/rfqs/${rfqId}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        ...rfqBody(),
        title: "Updated bulk materials request",
      })
      .expect(200);
    expect(updated.body.data.rfq.title).toBe(
      "Updated bulk materials request",
    );

    const listing = await request(app)
      .get("/api/rfqs/me?page=1&limit=10&status=OPEN")
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(200);
    expect(listing.body.data.pagination).toMatchObject({
      page: 1,
      limit: 10,
      total: 1,
    });
    expect(listing.body.data.rfqs[0].id).toBe(rfqId);

    const cancelled = await request(app)
      .patch(`/api/rfqs/${rfqId}/cancel`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({})
      .expect(200);
    expect(cancelled.body.data.rfq.status).toBe("CANCELLED");
  });

  it("lists open RFQs only for sellers covering every requested category", async () => {
    const created = await createRfq(customerToken);
    const rfqId = created.body.data.rfq.id as string;

    const eligible = await request(app)
      .get("/api/seller/rfqs")
      .set("Authorization", `Bearer ${sellerToken}`)
      .expect(200);
    expect(eligible.body.data.rfqs[0].id).toBe(rfqId);

    const ineligible = await request(app)
      .get("/api/seller/rfqs")
      .set("Authorization", `Bearer ${ineligibleSellerToken}`)
      .expect(200);
    expect(ineligible.body.data.rfqs).toEqual([]);
  });

  it("supports seller quotation creation, revision, and withdrawal", async () => {
    const created = await createRfq(customerToken);
    const rfq = created.body.data.rfq;
    const submitted = await createQuote(
      sellerToken,
      rfq,
      sellerCementId,
      sellerSteelId,
    );
    const quoteId = submitted.body.data.quote.id as string;
    expect(submitted.body.data.quote).toMatchObject({
      sellerId,
      status: "SUBMITTED",
      totalAmount: "650.00",
    });

    const revised = await request(app)
      .put(`/api/quotes/${quoteId}`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send(
        quoteBody(rfq, sellerCementId, sellerSteelId, {
          firstPrice: "6.00",
          secondPrice: "11.00",
        }),
      )
      .expect(200);
    expect(revised.body.data.quote.totalAmount).toBe("740.00");

    const withdrawn = await request(app)
      .patch(`/api/quotes/${quoteId}/withdraw`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({})
      .expect(200);
    expect(withdrawn.body.data.quote.status).toBe("WITHDRAWN");
  });

  it("prevents editing an RFQ after the first quotation", async () => {
    const created = await createRfq(customerToken);
    const rfq = created.body.data.rfq;
    await createQuote(sellerToken, rfq, sellerCementId, sellerSteelId);

    const response = await request(app)
      .put(`/api/rfqs/${rfq.id}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send(rfqBody())
      .expect(409);
    expect(response.body.message).toBe(
      "An RFQ cannot be edited after a quotation has been submitted.",
    );
  });

  it("enforces quote coverage, product ownership, and category matching", async () => {
    const created = await createRfq(customerToken);
    const rfq = created.body.data.rfq;

    const incomplete = quoteBody(rfq, sellerCementId, sellerSteelId);
    incomplete.items.pop();
    const coverage = await request(app)
      .post(`/api/rfqs/${rfq.id}/quotes`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send(incomplete)
      .expect(400);
    expect(coverage.body.message).toBe(
      "A quotation must cover every RFQ item exactly once.",
    );

    const wrongOwner = quoteBody(
      rfq,
      secondSellerCementId,
      secondSellerSteelId,
    );
    const ownership = await request(app)
      .post(`/api/rfqs/${rfq.id}/quotes`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send(wrongOwner)
      .expect(403);
    expect(ownership.body.message).toBe(
      "Every quoted product must belong to the authenticated seller.",
    );

    const wrongCategory = quoteBody(rfq, sellerSteelId, sellerCementId);
    const category = await request(app)
      .post(`/api/rfqs/${rfq.id}/quotes`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send(wrongCategory)
      .expect(400);
    expect(category.body.message).toBe(
      "Every quoted product must match its requested category.",
    );
  });

  it("enforces authentication, roles, customer ownership, and admin access", async () => {
    await request(app).post("/api/rfqs").send(rfqBody()).expect(401);
    await createRfq(sellerToken, 403);

    const created = await createRfq(customerToken);
    const rfqId = created.body.data.rfq.id as string;

    await request(app)
      .get(`/api/rfqs/${rfqId}`)
      .set("Authorization", `Bearer ${otherCustomerToken}`)
      .expect(403);
    await request(app)
      .post(`/api/rfqs/${rfqId}/quotes`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({})
      .expect(403);

    const admin = await request(app)
      .get("/api/admin/rfqs")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(admin.body.data.rfqs[0].id).toBe(rfqId);
  });

  it("isolates customer lists and hides competing quote details from sellers", async () => {
    const first = await createRfq(customerToken);
    await createRfq(otherCustomerToken);
    const rfq = first.body.data.rfq;
    await createQuote(sellerToken, rfq, sellerCementId, sellerSteelId);
    await createQuote(
      secondSellerToken,
      rfq,
      secondSellerCementId,
      secondSellerSteelId,
    );

    const customerList = await request(app)
      .get("/api/rfqs/me")
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(200);
    expect(customerList.body.data.rfqs).toHaveLength(1);
    expect(customerList.body.data.rfqs[0].quotes).toHaveLength(2);

    const sellerDetail = await request(app)
      .get(`/api/rfqs/${rfq.id}`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .expect(200);
    expect(sellerDetail.body.data.rfq.quotes).toHaveLength(1);
    expect(sellerDetail.body.data.rfq.quotes[0].sellerId).toBe(sellerId);
  });

  it("rejects a quote and prevents subsequent seller changes", async () => {
    const created = await createRfq(customerToken);
    const rfq = created.body.data.rfq;
    const submitted = await createQuote(
      sellerToken,
      rfq,
      sellerCementId,
      sellerSteelId,
    );
    const quoteId = submitted.body.data.quote.id as string;

    await request(app)
      .post(`/api/quotes/${quoteId}/reject`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({})
      .expect(200);

    const response = await request(app)
      .put(`/api/quotes/${quoteId}`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send(quoteBody(rfq, sellerCementId, sellerSteelId))
      .expect(409);
    expect(response.body.message).toBe(
      "Only submitted quotations can be changed.",
    );
  });

  it("accepts one quote, creates an order at quoted prices, and reserves stock", async () => {
    const created = await createRfq(customerToken);
    const rfq = created.body.data.rfq;
    const firstQuote = await createQuote(
      sellerToken,
      rfq,
      sellerCementId,
      sellerSteelId,
    );
    const winningQuote = await createQuote(
      secondSellerToken,
      rfq,
      secondSellerCementId,
      secondSellerSteelId,
      { firstPrice: "4.00", secondPrice: "8.00" },
    );

    const response = await request(app)
      .post(`/api/quotes/${winningQuote.body.data.quote.id}/accept`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({})
      .expect(201);

    expect(response.body.data.order).toMatchObject({
      customerId,
      status: "PENDING",
      totalAmount: "520.00",
      items: [
        {
          productId: secondSellerCementId,
          quantity: 50,
          price: "4.00",
        },
        {
          productId: secondSellerSteelId,
          quantity: 40,
          price: "8.00",
        },
      ],
    });
    expect(response.body.data.rfq).toMatchObject({
      status: "AWARDED",
      awardedQuoteId: winningQuote.body.data.quote.id,
    });
    const firstAfter = response.body.data.rfq.quotes.find(
      (quote: { id: string }) => quote.id === firstQuote.body.data.quote.id,
    );
    expect(firstAfter.status).toBe("REJECTED");
    expect(rfqs.getProductQuantity(secondSellerCementId)).toBe(50);
    expect(rfqs.getProductQuantity(secondSellerSteelId)).toBe(10);
    expect(rfqs.getOrders()).toHaveLength(1);
  });

  it("rolls back quote acceptance when any product has insufficient stock", async () => {
    const created = await createRfq(customerToken);
    const rfq = created.body.data.rfq;
    const submitted = await createQuote(
      sellerToken,
      rfq,
      sellerCementId,
      sellerSteelId,
    );
    rfqs.setProductQuantity(sellerSteelId, 10);

    const response = await request(app)
      .post(`/api/quotes/${submitted.body.data.quote.id}/accept`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({})
      .expect(409);
    expect(response.body.message).toBe(
      `Insufficient stock for quoted product ${sellerSteelId}.`,
    );
    expect(rfqs.getProductQuantity(sellerCementId)).toBe(100);
    expect(rfqs.getProductQuantity(sellerSteelId)).toBe(10);
    expect(rfqs.getOrders()).toEqual([]);
  });

  it("rejects acceptance when a quoted product was deleted", async () => {
    const created = await createRfq(customerToken);
    const rfq = created.body.data.rfq;
    const submitted = await createQuote(
      sellerToken,
      rfq,
      sellerCementId,
      sellerSteelId,
    );
    rfqs.removeProduct(sellerSteelId);

    const response = await request(app)
      .post(`/api/quotes/${submitted.body.data.quote.id}/accept`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({})
      .expect(409);
    expect(response.body.message).toBe(
      "A quoted product is no longer available.",
    );
  });

  it("allows only one concurrent acceptance to create an order", async () => {
    const created = await createRfq(customerToken);
    const rfq = created.body.data.rfq;
    const submitted = await createQuote(
      sellerToken,
      rfq,
      sellerCementId,
      sellerSteelId,
    );
    const quoteId = submitted.body.data.quote.id as string;

    const [first, second] = await Promise.all([
      request(app)
        .post(`/api/quotes/${quoteId}/accept`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({}),
      request(app)
        .post(`/api/quotes/${quoteId}/accept`)
        .set("Authorization", `Bearer ${customerToken}`)
        .send({}),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect(rfqs.getOrders()).toHaveLength(1);
    expect(rfqs.getProductQuantity(sellerCementId)).toBe(50);
    expect(rfqs.getProductQuantity(sellerSteelId)).toBe(10);
  });

  it("expires open RFQs and closes submitted quotations", async () => {
    const created = await createRfq(customerToken);
    const rfq = created.body.data.rfq;
    await createQuote(sellerToken, rfq, sellerCementId, sellerSteelId);
    rfqs.setRfqExpiresAt(rfq.id, new Date(Date.now() - 1));

    const response = await request(app)
      .get(`/api/rfqs/${rfq.id}`)
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(200);
    expect(response.body.data.rfq.status).toBe("EXPIRED");
    expect(response.body.data.rfq.quotes[0].status).toBe("CLOSED");
  });

  it("strictly validates RFQ and quotation input", async () => {
    const shortExpiry = await request(app)
      .post("/api/rfqs")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({
        ...rfqBody(),
        expiresAt: futureIso(0.1),
      })
      .expect(400);
    expect(shortExpiry.body.message).toBe(
      "RFQ expiry must be between 24 hours and 90 days from now.",
    );

    await request(app)
      .post("/api/rfqs")
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ ...rfqBody(), unexpected: true })
      .expect(400);

    const customUnit = rfqBody();
    const firstCustomUnitItem = customUnit.items[0]!;
    customUnit.items[0] = {
      ...firstCustomUnitItem,
      requestedUnit: "OTHER",
    };
    await request(app)
      .post("/api/rfqs")
      .set("Authorization", `Bearer ${customerToken}`)
      .send(customUnit)
      .expect(400);

    const created = await createRfq(customerToken);
    const excessiveAmount = quoteBody(
      created.body.data.rfq,
      sellerCementId,
      sellerSteelId,
    );
    excessiveAmount.items[0]!.offeredQuantity = 2_147_483_647;
    excessiveAmount.items[0]!.unitPrice = "9999999999.99";
    const excessiveResponse = await request(app)
      .post(`/api/rfqs/${created.body.data.rfq.id}/quotes`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send(excessiveAmount)
      .expect(400);
    expect(excessiveResponse.body.message).toBe(
      "The supplier quotation total exceeds the supported amount.",
    );

    const quote = quoteBody(
      created.body.data.rfq,
      sellerCementId,
      sellerCementId,
    );
    const duplicateProduct = await request(app)
      .post(`/api/rfqs/${created.body.data.rfq.id}/quotes`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .send(quote)
      .expect(400);
    expect(duplicateProduct.body.errors[0].field).toContain("productId");

    await request(app)
      .get("/api/rfqs/me?unknown=true")
      .set("Authorization", `Bearer ${customerToken}`)
      .expect(400);
  });

  function addProduct(
    id: string,
    ownerId: string,
    categoryId: string,
    name: string,
    quantity: number,
  ): void {
    rfqs.addProduct({
      id,
      sellerId: ownerId,
      categoryId,
      name,
      imageUrl: null,
      quantity,
    });
  }

  function token(
    userId: string,
    role: "CUSTOMER" | "SELLER" | "ADMIN",
  ): string {
    return tokenService.createAccessToken({ userId, role });
  }

  function createRfq(accessToken: string, status = 201) {
    return request(app)
      .post("/api/rfqs")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(rfqBody())
      .expect(status);
  }

  function createQuote(
    accessToken: string,
    rfq: RfqResponse,
    cementProductId: string,
    steelProductId: string,
    prices: QuotePrices = {},
    status = 201,
  ) {
    return request(app)
      .post(`/api/rfqs/${rfq.id}/quotes`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(quoteBody(rfq, cementProductId, steelProductId, prices))
      .expect(status);
  }
});

interface RfqResponse {
  id: string;
  items: Array<{ id: string }>;
}

interface QuotePrices {
  firstPrice?: string;
  secondPrice?: string;
}

function rfqBody() {
  return {
    title: "Bulk structural materials",
    deliveryLocation: "Industrial Area, Nairobi",
    notes: "Quote catalog-equivalent materials.",
    expiresAt: futureIso(7),
    items: [
      {
        categoryId: cementCategoryId,
        materialName: "General purpose cement",
        specifications: "50 kg bags",
        requestedQuantity: "2.500",
        requestedUnit: "TONNE",
      },
      {
        categoryId: steelCategoryId,
        materialName: "Reinforcement steel",
        requestedQuantity: "40",
        requestedUnit: "PIECE",
      },
    ],
  };
}

function quoteBody(
  rfq: RfqResponse,
  cementProductId: string,
  steelProductId: string,
  prices: QuotePrices = {},
) {
  return {
    validUntil: futureIso(3),
    leadTimeDays: 5,
    terms: "Material pricing only.",
    items: [
      {
        rfqItemId: rfq.items[0]?.id,
        productId: cementProductId,
        offeredQuantity: 50,
        unitPrice: prices.firstPrice ?? "5.00",
      },
      {
        rfqItemId: rfq.items[1]?.id,
        productId: steelProductId,
        offeredQuantity: 40,
        unitPrice: prices.secondPrice ?? "10.00",
      },
    ],
  };
}

function futureIso(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
