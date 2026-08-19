import {
  Prisma,
  type PrismaClient,
} from "../src/prisma/generated/client.js";
import {
  DuplicateSupplierQuoteError,
  RfqInsufficientStockError,
} from "../src/repositories/rfq.errors.js";
import { PrismaRfqRepository } from "../src/repositories/prisma-rfq.repository.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rfqId = "00000000-0000-4000-8000-000000000001";
const customerId = "00000000-0000-4000-8000-000000000002";
const sellerId = "00000000-0000-4000-8000-000000000003";
const categoryId = "00000000-0000-4000-8000-000000000004";
const secondCategoryId = "00000000-0000-4000-8000-000000000005";
const rfqItemId = "00000000-0000-4000-8000-000000000006";
const secondRfqItemId = "00000000-0000-4000-8000-000000000007";
const productId = "00000000-0000-4000-8000-000000000008";
const secondProductId = "00000000-0000-4000-8000-000000000009";
const quoteId = "00000000-0000-4000-8000-000000000010";
const orderId = "00000000-0000-4000-8000-000000000011";

describe("PrismaRfqRepository", () => {
  let client: ReturnType<typeof createPrismaClientMock>;
  let repository: PrismaRfqRepository;

  beforeEach(() => {
    client = createPrismaClientMock();
    repository = new PrismaRfqRepository(
      client as unknown as PrismaClient,
    );
  });

  it("creates an RFQ with category and preferred-product snapshots", async () => {
    client.category.findMany.mockResolvedValue([
      { id: categoryId, name: "Cement" },
    ]);
    client.product.findMany.mockResolvedValue([
      { id: productId, categoryId },
    ]);
    client.requestForQuote.create.mockResolvedValue(rfqRecord());

    const result = await repository.create({
      customerId,
      title: "Bulk cement",
      deliveryLocation: "Nairobi",
      expiresAt: futureDate(7),
      items: [
        {
          categoryId,
          preferredProductId: productId,
          materialName: "Cement",
          requestedQuantity: "2.500",
          requestedUnit: "TONNE",
        },
      ],
    });

    expect(result.id).toBe(rfqId);
    expect(client.requestForQuote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId,
          items: {
            create: [
              expect.objectContaining({
                categoryId,
                preferredProductId: productId,
                categoryName: "Cement",
                requestedUnit: "TONNE",
              }),
            ],
          },
        }),
      }),
    );
  });

  it("creates a complete supplier quote and calculates totals with decimals", async () => {
    client.requestForQuote.findMany.mockResolvedValue([]);
    client.requestForQuote.findUnique.mockResolvedValue({
      id: rfqId,
      status: "OPEN",
      expiresAt: futureDate(7),
      items: [
        { id: rfqItemId, categoryId },
        { id: secondRfqItemId, categoryId: secondCategoryId },
      ],
    });
    client.product.findMany.mockResolvedValue([
      productRecord(),
      productRecord({
        id: secondProductId,
        categoryId: secondCategoryId,
        name: "Steel",
      }),
    ]);
    client.supplierQuote.create.mockResolvedValue(quoteRecord());

    const result = await repository.createQuote({
      rfqId,
      sellerId,
      validUntil: futureDate(3),
      leadTimeDays: 5,
      items: [
        {
          rfqItemId,
          productId,
          offeredQuantity: 50,
          unitPrice: "5.00",
        },
        {
          rfqItemId: secondRfqItemId,
          productId: secondProductId,
          offeredQuantity: 40,
          unitPrice: "10.00",
        },
      ],
    });

    expect(result.totalAmount).toBe("650.00");
    expect(client.supplierQuote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalAmount: new Prisma.Decimal("650.00"),
          items: {
            create: [
              expect.objectContaining({
                lineTotal: new Prisma.Decimal("250.00"),
              }),
              expect.objectContaining({
                lineTotal: new Prisma.Decimal("400.00"),
              }),
            ],
          },
        }),
      }),
    );
  });

  it("translates concurrent duplicate quote insertion", async () => {
    client.requestForQuote.findMany.mockResolvedValue([]);
    client.requestForQuote.findUnique.mockResolvedValue({
      id: rfqId,
      status: "OPEN",
      expiresAt: futureDate(7),
      items: [{ id: rfqItemId, categoryId }],
    });
    client.product.findMany.mockResolvedValue([productRecord()]);
    client.supplierQuote.create.mockRejectedValue(prismaError("P2002"));

    await expect(
      repository.createQuote({
        rfqId,
        sellerId,
        validUntil: futureDate(3),
        leadTimeDays: 5,
        items: [
          {
            rfqItemId,
            productId,
            offeredQuantity: 10,
            unitPrice: "5.00",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(DuplicateSupplierQuoteError);
  });

  it("atomically accepts a quote, reserves SellerInventory, and creates a quoted-price order", async () => {
    client.requestForQuote.findMany.mockResolvedValue([]);
    client.supplierQuote.findUnique
      .mockResolvedValueOnce({ rfqId })
      .mockResolvedValueOnce(acceptanceQuoteRecord());
    // inventoryTransaction.findUnique (idempotency check) — not found, proceed
    client.inventoryTransaction.findUnique.mockResolvedValue(null);
    // sellerInventory.findUnique — return inventory with sufficient stock
    client.sellerInventory.findUnique.mockResolvedValue({
      city: "Nairobi",
      quantity: 100,
    });
    // sellerInventory.updateMany — atomic decrement succeeds
    client.sellerInventory.updateMany.mockResolvedValue({ count: 1 });
    // inventoryTransaction.create — record the deduction
    client.inventoryTransaction.create.mockResolvedValue({});
    client.order.create.mockResolvedValue(orderRecord());
    client.supplierQuote.update.mockResolvedValue({});
    client.supplierQuote.updateMany.mockResolvedValue({ count: 1 });
    client.requestForQuote.update.mockResolvedValue({});
    client.requestForQuote.findUniqueOrThrow.mockResolvedValue(
      rfqRecord({
        status: "AWARDED",
        awardedQuoteId: quoteId,
        quotes: [
          quoteRecord({
            status: "ACCEPTED",
            orderId,
          }),
        ],
      }),
    );

    const result = await repository.acceptQuote(quoteId, customerId);

    expect(result.order).toMatchObject({
      id: orderId,
      status: "PENDING",
      totalAmount: "650.00",
    });
    // SellerInventory must be decremented, not Product.quantity
    expect(client.sellerInventory.updateMany).toHaveBeenCalled();
    expect(client.product.updateMany).not.toHaveBeenCalled();
    expect(client.inventoryTransaction.create).toHaveBeenCalled();
    expect(client.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          customerId,
          totalAmount: new Prisma.Decimal("650"),
          items: {
            create: [
              {
                productId,
                quantity: 50,
                price: new Prisma.Decimal("5.00"),
              },
              {
                productId: secondProductId,
                quantity: 40,
                price: new Prisma.Decimal("10.00"),
              },
            ],
          },
        },
      }),
    );
    expect(client.requestForQuote.update).toHaveBeenCalledWith({
      where: { id: rfqId },
      data: {
        status: "AWARDED",
        awardedQuoteId: quoteId,
      },
    });
  });

  it("does not create an order when a quoted line lacks SellerInventory stock", async () => {
    client.requestForQuote.findMany.mockResolvedValue([]);
    client.supplierQuote.findUnique
      .mockResolvedValueOnce({ rfqId })
      .mockResolvedValueOnce(acceptanceQuoteRecord());
    // Pre-validation: first item has stock, second item has insufficient stock
    client.sellerInventory.findUnique
      .mockResolvedValueOnce({ city: "Nairobi", quantity: 100 }) // first OK
      .mockResolvedValueOnce({ city: "Nairobi", quantity: 1 });  // second: quantity < offeredQuantity (40)

    await expect(
      repository.acceptQuote(quoteId, customerId),
    ).rejects.toBeInstanceOf(RfqInsufficientStockError);
    // Order must NOT be created when stock check fails
    expect(client.order.create).not.toHaveBeenCalled();
    expect(client.requestForQuote.update).not.toHaveBeenCalled();
  });

  it("loads only the authenticated seller's quotations for seller listings", async () => {
    client.requestForQuote.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([rfqRecord()]);
    client.requestForQuote.count.mockResolvedValue(1);

    await repository.findForSeller(sellerId, {
      page: 1,
      limit: 20,
      view: "available",
    });

    expect(client.requestForQuote.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        include: expect.objectContaining({
          quotes: expect.objectContaining({
            where: { sellerId },
          }),
        }),
      }),
    );
  });

  it("expires RFQs before closing their submitted quotations", async () => {
    client.requestForQuote.findMany.mockResolvedValue([{ id: rfqId }]);
    client.requestForQuote.updateMany.mockResolvedValue({ count: 1 });
    client.supplierQuote.updateMany.mockResolvedValue({ count: 1 });
    client.requestForQuote.findUnique.mockResolvedValue(null);

    await repository.findById(rfqId);

    expect(
      client.requestForQuote.updateMany.mock.invocationCallOrder[0],
    ).toBeLessThan(
      client.supplierQuote.updateMany.mock.invocationCallOrder[0]!,
    );
    expect(client.supplierQuote.updateMany).toHaveBeenCalledWith({
      where: {
        rfqId: { in: [rfqId] },
        status: "SUBMITTED",
        rfq: {
          status: "EXPIRED",
        },
      },
      data: { status: "CLOSED" },
    });
  });
});

function createPrismaClientMock() {
  const client = {
    category: {
      findMany: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    sellerInventory: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    inventoryTransaction: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    requestForQuote: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    rfqItem: {
      deleteMany: vi.fn(),
    },
    supplierQuote: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    supplierQuoteItem: {
      deleteMany: vi.fn(),
    },
    order: {
      create: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ id: rfqId }]),
    $transaction: vi.fn(),
  };

  client.$transaction.mockImplementation(
    async (
      operation:
        | Array<Promise<unknown>>
        | ((transaction: typeof client) => Promise<unknown>),
    ) =>
      Array.isArray(operation)
        ? Promise.all(operation)
        : operation(client),
  );

  return client;
}

function rfqRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: rfqId,
    customerId,
    title: "Bulk materials",
    deliveryLocation: "Nairobi",
    notes: null,
    status: "OPEN",
    expiresAt: futureDate(7),
    awardedQuoteId: null,
    customer: {
      id: customerId,
      name: "Primary Customer",
      company: "Builders",
    },
    items: [
      {
        id: rfqItemId,
        rfqId,
        categoryId,
        preferredProductId: productId,
        categoryName: "Cement",
        materialName: "Cement",
        specifications: null,
        requestedQuantity: new Prisma.Decimal("2.500"),
        requestedUnit: "TONNE",
        customUnit: null,
        preferredProduct: productRecord(),
        createdAt: new Date("2026-07-20T08:00:00.000Z"),
      },
    ],
    quotes: [],
    createdAt: new Date("2026-07-20T08:00:00.000Z"),
    updatedAt: new Date("2026-07-20T08:00:00.000Z"),
    ...overrides,
  };
}

function quoteRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: quoteId,
    rfqId,
    sellerId,
    status: "SUBMITTED",
    validUntil: futureDate(3),
    leadTimeDays: 5,
    terms: null,
    totalAmount: new Prisma.Decimal("650.00"),
    orderId: null,
    seller: {
      id: sellerId,
      name: "Supplier",
      company: "Supplier Ltd",
      sellerProfile: { shopName: "Supplier Shop" },
    },
    items: [
      {
        id: "00000000-0000-4000-8000-000000000012",
        quoteId,
        rfqItemId,
        productId,
        productName: "Cement",
        offeredQuantity: 50,
        unitPrice: new Prisma.Decimal("5.00"),
        lineTotal: new Prisma.Decimal("250.00"),
        product: productRecord(),
        createdAt: new Date("2026-07-20T09:00:00.000Z"),
      },
      {
        id: "00000000-0000-4000-8000-000000000013",
        quoteId,
        rfqItemId: secondRfqItemId,
        productId: secondProductId,
        productName: "Steel",
        offeredQuantity: 40,
        unitPrice: new Prisma.Decimal("10.00"),
        lineTotal: new Prisma.Decimal("400.00"),
        product: productRecord({
          id: secondProductId,
          categoryId: secondCategoryId,
          name: "Steel",
        }),
        createdAt: new Date("2026-07-20T09:00:00.000Z"),
      },
    ],
    createdAt: new Date("2026-07-20T09:00:00.000Z"),
    updatedAt: new Date("2026-07-20T09:00:00.000Z"),
    ...overrides,
  };
}

function acceptanceQuoteRecord() {
  return {
    id: quoteId,
    rfqId,
    sellerId,
    status: "SUBMITTED",
    validUntil: futureDate(3),
    totalAmount: new Prisma.Decimal("650.00"),
    rfq: {
      id: rfqId,
      customerId,
      status: "OPEN",
      expiresAt: futureDate(7),
      items: [
        { id: rfqItemId, categoryId },
        { id: secondRfqItemId, categoryId: secondCategoryId },
      ],
    },
    seller: {
      isActive: true,
    },
    items: quoteRecord().items,
  };
}

function productRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: productId,
    sellerId,
    categoryId,
    name: "Cement",
    imageUrl: null,
    ...overrides,
  };
}

function orderRecord() {
  return {
    id: orderId,
    customerId,
    status: "PENDING",
    totalAmount: new Prisma.Decimal("650.00"),
    customer: {
      id: customerId,
      name: "Primary Customer",
      email: "primary@example.com",
    },
    items: [
      {
        id: "00000000-0000-4000-8000-000000000014",
        orderId,
        productId,
        quantity: 50,
        price: new Prisma.Decimal("5.00"),
        product: {
          id: productId,
          sellerId,
          name: "Cement",
          imageUrl: null,
        },
      },
      {
        id: "00000000-0000-4000-8000-000000000015",
        orderId,
        productId: secondProductId,
        quantity: 40,
        price: new Prisma.Decimal("10.00"),
        product: {
          id: secondProductId,
          sellerId,
          name: "Steel",
          imageUrl: null,
        },
      },
    ],
    createdAt: new Date("2026-07-20T10:00:00.000Z"),
    updatedAt: new Date("2026-07-20T10:00:00.000Z"),
  };
}

function futureDate(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function prismaError(code: string): Error & { code: string } {
  return Object.assign(new Error(`Prisma error ${code}`), { code });
}
