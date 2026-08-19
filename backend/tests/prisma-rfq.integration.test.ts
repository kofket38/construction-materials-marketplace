import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  Prisma,
  PrismaClient,
} from "../src/prisma/generated/client.js";
import {
  RfqInsufficientStockError,
  SupplierQuoteSellerInactiveError,
} from "../src/repositories/rfq.errors.js";
import { PrismaRfqRepository } from "../src/repositories/prisma-rfq.repository.js";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

interface TestResources {
  userIds: string[];
  categoryIds: string[];
}

interface SellerFixture {
  id: string;
  productIds: [string, string];
}

interface RfqScenario {
  customerId: string;
  seller: SellerFixture;
  secondSeller: SellerFixture | null;
  rfqId: string;
  quoteId: string;
  secondQuoteId: string | null;
}

describe.sequential("PrismaRfqRepository PostgreSQL integration", () => {
  let prisma: PrismaClient;
  let lockClient: PrismaClient;
  let repository: PrismaRfqRepository;
  let secondRepository: PrismaRfqRepository;
  let resources: TestResources;

  beforeAll(() => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for PostgreSQL integration tests.");
    }
    prisma = createPrismaClient(connectionString);
    lockClient = createPrismaClient(connectionString);
    repository = new PrismaRfqRepository(prisma);
    secondRepository = new PrismaRfqRepository(lockClient);
  });

  afterEach(async () => {
    await cleanupResources(prisma, resources);
  });

  afterAll(async () => {
    await Promise.all([prisma.$disconnect(), lockClient.$disconnect()]);
  });

  it("accepts an RFQ quote and reserves SellerInventory (not Product.quantity)", async () => {
    resources = emptyResources();
    const scenario = await seedScenario(prisma, repository, resources);

    const result = await repository.acceptQuote(
      scenario.quoteId,
      scenario.customerId,
    );

    expect(result.rfq).toMatchObject({
      id: scenario.rfqId,
      status: "AWARDED",
      awardedQuoteId: scenario.quoteId,
    });
    expect(result.order).toMatchObject({
      customerId: scenario.customerId,
      status: "PENDING",
      totalAmount: "650.00",
    });

    const [rfq, quote, products, sellerInventories, txns] = await Promise.all([
      prisma.requestForQuote.findUniqueOrThrow({
        where: { id: scenario.rfqId },
      }),
      prisma.supplierQuote.findUniqueOrThrow({
        where: { id: scenario.quoteId },
      }),
      prisma.product.findMany({
        where: { id: { in: scenario.seller.productIds } },
        orderBy: { id: "asc" },
      }),
      prisma.sellerInventory.findMany({
        where: { sellerId: scenario.seller.id },
        orderBy: { id: "asc" },
      }),
      prisma.inventoryTransaction.findMany({
        where: { orderId: result.order.id },
        select: { type: true, quantityChange: true, sellerId: true, city: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    expect(rfq).toMatchObject({
      status: "AWARDED",
      awardedQuoteId: scenario.quoteId,
    });
    expect(quote).toMatchObject({
      status: "ACCEPTED",
      orderId: result.order.id,
    });

    // Product.quantity must remain UNCHANGED — SellerInventory is authoritative.
    expect(products.map((p) => p.quantity)).toEqual([100, 100]);

    // SellerInventory.quantity must be decremented by the offered quantities.
    const sortedInvQty = sellerInventories.map((si) => si.quantity).sort((a, b) => a - b);
    expect(sortedInvQty).toEqual([50, 60]);

    // InventoryTransaction records must be created.
    expect(txns).toHaveLength(2);
    expect(txns.every((t) => t.type === "ORDER_SHIPMENT")).toBe(true);
    expect(txns.every((t) => t.sellerId === scenario.seller.id)).toBe(true);
    expect(txns.map((t) => t.quantityChange).sort((a, b) => a - b)).toEqual([-50, -40]);
  });

  it("rolls back SellerInventory reservations when a later quoted item lacks stock", async () => {
    resources = emptyResources();
    const scenario = await seedScenario(prisma, repository, resources);
    const quote = await prisma.supplierQuote.findUniqueOrThrow({
      where: { id: scenario.quoteId },
      include: { items: { orderBy: { id: "asc" } } },
    });
    const firstItem = quote.items[0]!;
    const secondItem = quote.items[1]!;

    // Record the first product's SellerInventory before the attempt.
    const firstInvBefore = await prisma.sellerInventory.findFirstOrThrow({
      where: { sellerId: scenario.seller.id, productId: firstItem.productId! },
      select: { quantity: true },
    });

    // Zero out the second product's SellerInventory to force a stock failure.
    await prisma.sellerInventory.updateMany({
      where: { sellerId: scenario.seller.id, productId: secondItem.productId! },
      data: { quantity: secondItem.offeredQuantity - 1 },
    });

    await expect(
      repository.acceptQuote(scenario.quoteId, scenario.customerId),
    ).rejects.toBeInstanceOf(RfqInsufficientStockError);

    const [firstInvAfter, rfq, persistedQuote, orderCount] =
      await Promise.all([
        prisma.sellerInventory.findFirstOrThrow({
          where: { sellerId: scenario.seller.id, productId: firstItem.productId! },
          select: { quantity: true },
        }),
        prisma.requestForQuote.findUniqueOrThrow({
          where: { id: scenario.rfqId },
        }),
        prisma.supplierQuote.findUniqueOrThrow({
          where: { id: scenario.quoteId },
        }),
        prisma.order.count({
          where: { customerId: scenario.customerId },
        }),
      ]);

    // First product's SellerInventory must be rolled back.
    expect(firstInvAfter.quantity).toBe(firstInvBefore.quantity);
    expect(rfq.status).toBe("OPEN");
    expect(persistedQuote.status).toBe("SUBMITTED");
    expect(orderCount).toBe(0);
  });

  it("allows only one of two competing concurrent acceptances to commit", async () => {
    resources = emptyResources();
    const scenario = await seedScenario(prisma, repository, resources, {
      includeSecondSeller: true,
    });

    const attempts = await Promise.allSettled([
      repository.acceptQuote(scenario.quoteId, scenario.customerId),
      secondRepository.acceptQuote(
        scenario.secondQuoteId!,
        scenario.customerId,
      ),
    ]);

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(
      1,
    );

    const [rfq, quotes, orderCount] = await Promise.all([
      prisma.requestForQuote.findUniqueOrThrow({
        where: { id: scenario.rfqId },
      }),
      prisma.supplierQuote.findMany({
        where: { rfqId: scenario.rfqId },
      }),
      prisma.order.count({
        where: { customerId: scenario.customerId },
      }),
    ]);
    const accepted = quotes.find((quote) => quote.status === "ACCEPTED");
    const rejected = quotes.find((quote) => quote.status === "REJECTED");

    expect(rfq).toMatchObject({
      status: "AWARDED",
      awardedQuoteId: accepted?.id,
    });
    expect(accepted).toBeDefined();
    expect(rejected).toBeDefined();
    expect(orderCount).toBe(1);

    const acceptedSeller =
      accepted?.sellerId === scenario.seller.id
        ? scenario.seller
        : scenario.secondSeller!;
    const rejectedSeller =
      acceptedSeller.id === scenario.seller.id
        ? scenario.secondSeller!
        : scenario.seller;
    const [acceptedInventories, rejectedInventories] = await Promise.all([
      prisma.sellerInventory.findMany({
        where: { sellerId: acceptedSeller.id },
      }),
      prisma.sellerInventory.findMany({
        where: { sellerId: rejectedSeller.id },
      }),
    ]);

    // Accepted seller's SellerInventory is decremented.
    expect(
      acceptedInventories.map((si) => si.quantity).sort((a, b) => a - b),
    ).toEqual([50, 60]);
    // Rejected seller's SellerInventory is untouched.
    expect(rejectedInventories.map((si) => si.quantity).sort((a, b) => a - b)).toEqual([
      100,
      100,
    ]);
  });

  it("waits for an existing RFQ row lock before accepting a quote", async () => {
    resources = emptyResources();
    const scenario = await seedScenario(prisma, repository, resources);
    let releaseLock: (() => void) | undefined;
    let reportLocked: (() => void) | undefined;
    const lockReleased = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const lockAcquired = new Promise<void>((resolve) => {
      reportLocked = resolve;
    });
    const lockTransaction = lockClient.$transaction(
      async (transaction) => {
        await transaction.$queryRaw(
          Prisma.sql`
            SELECT "id"
            FROM "request_for_quotes"
            WHERE "id" = ${scenario.rfqId}::uuid
            FOR UPDATE
          `,
        );
        reportLocked?.();
        await lockReleased;
      },
      { timeout: 10_000 },
    );

    await lockAcquired;
    let acceptanceSettled = false;
    const acceptance = repository
      .acceptQuote(scenario.quoteId, scenario.customerId)
      .finally(() => {
        acceptanceSettled = true;
      });

    try {
      await delay(200);
      expect(acceptanceSettled).toBe(false);
    } finally {
      releaseLock?.();
      await lockTransaction;
    }

    const result = await acceptance;
    expect(result.rfq.status).toBe("AWARDED");
  });

  it("enforces quotation and accepted-award uniqueness in PostgreSQL", async () => {
    resources = emptyResources();
    const scenario = await seedScenario(prisma, repository, resources, {
      includeSecondSeller: true,
    });
    const quote = await prisma.supplierQuote.findUniqueOrThrow({
      where: { id: scenario.quoteId },
      include: { items: true },
    });

    await expect(
      prisma.supplierQuote.create({
        data: {
          rfqId: scenario.rfqId,
          sellerId: scenario.seller.id,
          validUntil: futureDate(2),
          leadTimeDays: 1,
          totalAmount: new Prisma.Decimal("1.00"),
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    const existingItem = quote.items[0]!;
    await expect(
      prisma.supplierQuoteItem.create({
        data: {
          quoteId: scenario.quoteId,
          rfqItemId: existingItem.rfqItemId,
          productId: existingItem.productId,
          productName: existingItem.productName,
          offeredQuantity: existingItem.offeredQuantity,
          unitPrice: existingItem.unitPrice,
          lineTotal: existingItem.lineTotal,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    const [firstOrder, secondOrder] = await Promise.all([
      prisma.order.create({
        data: {
          customerId: scenario.customerId,
          totalAmount: new Prisma.Decimal("650.00"),
        },
      }),
      prisma.order.create({
        data: {
          customerId: scenario.customerId,
          totalAmount: new Prisma.Decimal("520.00"),
        },
      }),
    ]);

    await expect(
      prisma.$transaction(async (transaction) => {
        await transaction.supplierQuote.update({
          where: { id: scenario.quoteId },
          data: {
            status: "ACCEPTED",
            orderId: firstOrder.id,
          },
        });
        await transaction.supplierQuote.update({
          where: { id: scenario.secondQuoteId! },
          data: {
            status: "ACCEPTED",
            orderId: secondOrder.id,
          },
        });
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("enforces cross-RFQ line, total, and award consistency constraints", async () => {
    resources = emptyResources();
    const scenario = await seedScenario(prisma, repository, resources, {
      includeSecondSeller: true,
    });
    const otherRfq = await repository.create({
      customerId: scenario.customerId,
      title: `Other RFQ ${randomUUID()}`,
      deliveryLocation: "Nairobi",
      expiresAt: futureDate(7),
      items: [
        {
          categoryId: resources.categoryIds[0]!,
          materialName: "Other cement",
          requestedQuantity: "1.000",
          requestedUnit: "TONNE",
        },
      ],
    });
    const quote = await prisma.supplierQuote.findUniqueOrThrow({
      where: { id: scenario.quoteId },
      include: { items: true },
    });

    await expect(
      prisma.supplierQuoteItem.update({
        where: { id: quote.items[0]!.id },
        data: { rfqItemId: otherRfq.items[0]!.id },
      }),
    ).rejects.toBeTruthy();

    await expect(
      prisma.supplierQuote.update({
        where: { id: scenario.quoteId },
        data: {
          totalAmount: quote.totalAmount.plus(1),
        },
      }),
    ).rejects.toBeTruthy();

    await expect(
      prisma.requestForQuote.update({
        where: { id: scenario.rfqId },
        data: {
          status: "AWARDED",
          awardedQuoteId: scenario.secondQuoteId!,
        },
      }),
    ).rejects.toBeTruthy();
  });

  it("validates the source quote total when a quotation line moves", async () => {
    resources = emptyResources();
    const scenario = await seedScenario(prisma, repository, resources, {
      includeSecondSeller: true,
    });
    const [sourceQuote, destinationQuote] = await Promise.all([
      prisma.supplierQuote.findUniqueOrThrow({
        where: { id: scenario.quoteId },
        include: { items: true },
      }),
      prisma.supplierQuote.findUniqueOrThrow({
        where: { id: scenario.secondQuoteId! },
        include: { items: true },
      }),
    ]);
    const movedItem = sourceQuote.items[0]!;
    const replacedItem = destinationQuote.items.find(
      (item) => item.rfqItemId === movedItem.rfqItemId,
    )!;
    const destinationTotal = destinationQuote.totalAmount
      .minus(replacedItem.lineTotal)
      .plus(movedItem.lineTotal);

    await expect(
      prisma.$transaction(async (transaction) => {
        await transaction.supplierQuoteItem.delete({
          where: { id: replacedItem.id },
        });
        await transaction.supplierQuoteItem.update({
          where: { id: movedItem.id },
          data: { quoteId: destinationQuote.id },
        });
        await transaction.supplierQuote.update({
          where: { id: destinationQuote.id },
          data: { totalAmount: destinationTotal },
        });
      }),
    ).rejects.toBeTruthy();
  });

  it("prevents de-awarding an RFQ while its selected quote remains accepted", async () => {
    resources = emptyResources();
    const scenario = await seedScenario(prisma, repository, resources);
    await repository.acceptQuote(scenario.quoteId, scenario.customerId);

    await expect(
      prisma.requestForQuote.update({
        where: { id: scenario.rfqId },
        data: {
          status: "CANCELLED",
          awardedQuoteId: null,
        },
      }),
    ).rejects.toBeTruthy();
  });

  it("prevents unaccepting a quote while its RFQ still awards it", async () => {
    resources = emptyResources();
    const scenario = await seedScenario(prisma, repository, resources);
    await repository.acceptQuote(scenario.quoteId, scenario.customerId);

    await expect(
      prisma.supplierQuote.update({
        where: { id: scenario.quoteId },
        data: {
          status: "REJECTED",
          orderId: null,
        },
      }),
    ).rejects.toBeTruthy();
  });

  it("rejects acceptance after the quoted seller is disabled", async () => {
    resources = emptyResources();
    const scenario = await seedScenario(prisma, repository, resources);
    await prisma.user.update({
      where: { id: scenario.seller.id },
      data: { isActive: false },
    });

    await expect(
      repository.acceptQuote(scenario.quoteId, scenario.customerId),
    ).rejects.toBeInstanceOf(SupplierQuoteSellerInactiveError);

    const [orderCount, inventories] = await Promise.all([
      prisma.order.count({
        where: { customerId: scenario.customerId },
      }),
      prisma.sellerInventory.findMany({
        where: { sellerId: scenario.seller.id },
      }),
    ]);
    expect(orderCount).toBe(0);
    expect(inventories.map((si) => si.quantity)).toEqual([100, 100]);
  });
});

function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

function emptyResources(): TestResources {
  return {
    userIds: [],
    categoryIds: [],
  };
}

async function seedScenario(
  prisma: PrismaClient,
  repository: PrismaRfqRepository,
  resources: TestResources,
  options: { includeSecondSeller?: boolean } = {},
): Promise<RfqScenario> {
  const suffix = randomUUID();
  const customer = await prisma.user.create({
    data: {
      name: "RFQ Integration Customer",
      email: `rfq-customer-${suffix}@example.com`,
      passwordHash: "integration-test-password-hash",
      role: "CUSTOMER",
      emailVerified: true,
    },
  });
  resources.userIds.push(customer.id);

  const categories = await Promise.all([
    prisma.category.create({
      data: { name: `RFQ Cement ${suffix}` },
    }),
    prisma.category.create({
      data: { name: `RFQ Steel ${suffix}` },
    }),
  ]);
  resources.categoryIds.push(...categories.map((category) => category.id));

  const seller = await createSellerFixture(
    prisma,
    resources,
    categories.map((category) => category.id) as [string, string],
    `primary-${suffix}`,
  );
  const secondSeller = options.includeSecondSeller
    ? await createSellerFixture(
        prisma,
        resources,
        categories.map((category) => category.id) as [string, string],
        `secondary-${suffix}`,
      )
    : null;

  const rfq = await repository.create({
    customerId: customer.id,
    title: `RFQ integration ${suffix}`,
    deliveryLocation: "Industrial Area, Nairobi",
    expiresAt: futureDate(7),
    items: [
      {
        categoryId: categories[0]!.id,
        materialName: "Cement",
        requestedQuantity: "2.500",
        requestedUnit: "TONNE",
      },
      {
        categoryId: categories[1]!.id,
        materialName: "Steel",
        requestedQuantity: "40",
        requestedUnit: "PIECE",
      },
    ],
  });
  const rfqItemsByCategory = new Map(
    rfq.items.map((item) => [item.categoryId, item.id]),
  );
  const quote = await repository.createQuote({
    rfqId: rfq.id,
    sellerId: seller.id,
    validUntil: futureDate(3),
    leadTimeDays: 5,
    items: [
      {
        rfqItemId: rfqItemsByCategory.get(categories[0]!.id)!,
        productId: seller.productIds[0],
        offeredQuantity: 50,
        unitPrice: "5.00",
      },
      {
        rfqItemId: rfqItemsByCategory.get(categories[1]!.id)!,
        productId: seller.productIds[1],
        offeredQuantity: 40,
        unitPrice: "10.00",
      },
    ],
  });
  const secondQuote = secondSeller
    ? await repository.createQuote({
        rfqId: rfq.id,
        sellerId: secondSeller.id,
        validUntil: futureDate(3),
        leadTimeDays: 4,
        items: [
          {
            rfqItemId: rfqItemsByCategory.get(categories[0]!.id)!,
            productId: secondSeller.productIds[0],
            offeredQuantity: 50,
            unitPrice: "4.00",
          },
          {
            rfqItemId: rfqItemsByCategory.get(categories[1]!.id)!,
            productId: secondSeller.productIds[1],
            offeredQuantity: 40,
            unitPrice: "8.00",
          },
        ],
      })
    : null;

  return {
    customerId: customer.id,
    seller,
    secondSeller,
    rfqId: rfq.id,
    quoteId: quote.id,
    secondQuoteId: secondQuote?.id ?? null,
  };
}

async function createSellerFixture(
  prisma: PrismaClient,
  resources: TestResources,
  categoryIds: [string, string],
  suffix: string,
): Promise<SellerFixture> {
  const seller = await prisma.user.create({
    data: {
      name: `RFQ Integration Seller ${suffix}`,
      email: `rfq-seller-${suffix}@example.com`,
      passwordHash: "integration-test-password-hash",
      role: "SELLER",
      emailVerified: true,
      sellerProfile: {
        create: {
          shopName: `RFQ Shop ${suffix}`,
          phone: "+254700000000",
          address: "Nairobi",
        },
      },
    },
  });
  resources.userIds.push(seller.id);

  const products = await Promise.all([
    prisma.product.create({
      data: {
        sellerId: seller.id,
        categoryId: categoryIds[0],
        name: `Cement ${suffix}`,
        description: "Integration test cement",
        price: new Prisma.Decimal("6.00"),
        quantity: 100,
      },
    }),
    prisma.product.create({
      data: {
        sellerId: seller.id,
        categoryId: categoryIds[1],
        name: `Steel ${suffix}`,
        description: "Integration test steel",
        price: new Prisma.Decimal("12.00"),
        quantity: 100,
      },
    }),
  ]);

  // SellerInventory is the authoritative stock source — must have entries
  // for reserveOrderInventory to work during RFQ acceptance.
  await Promise.all([
    prisma.sellerInventory.create({
      data: {
        sellerId: seller.id,
        productId: products[0].id,
        price: new Prisma.Decimal("6.00"),
        quantity: 100,
        city: "Nairobi",
      },
    }),
    prisma.sellerInventory.create({
      data: {
        sellerId: seller.id,
        productId: products[1].id,
        price: new Prisma.Decimal("12.00"),
        quantity: 100,
        city: "Nairobi",
      },
    }),
  ]);

  return {
    id: seller.id,
    productIds: [products[0].id, products[1].id],
  };
}

async function cleanupResources(
  prisma: PrismaClient,
  resources: TestResources | undefined,
): Promise<void> {
  if (!resources || resources.userIds.length === 0) {
    return;
  }

  await prisma.$transaction(async (transaction) => {
    const rfqs = await transaction.requestForQuote.findMany({
      where: { customerId: { in: resources.userIds } },
      select: { id: true },
    });
    const rfqIds = rfqs.map((rfq) => rfq.id);

    if (rfqIds.length > 0) {
      await transaction.requestForQuote.updateMany({
        where: {
          id: { in: rfqIds },
          status: "AWARDED",
        },
        data: {
          status: "CANCELLED",
          awardedQuoteId: null,
        },
      });
      await transaction.supplierQuote.deleteMany({
        where: { rfqId: { in: rfqIds } },
      });
      await transaction.requestForQuote.deleteMany({
        where: { id: { in: rfqIds } },
      });
    }
  });
  await prisma.order.deleteMany({
    where: { customerId: { in: resources.userIds } },
  });
  await prisma.sellerInventory.deleteMany({
    where: { sellerId: { in: resources.userIds } },
  });
  await prisma.product.deleteMany({
    where: { sellerId: { in: resources.userIds } },
  });
  await prisma.sellerProfile.deleteMany({
    where: { userId: { in: resources.userIds } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: resources.userIds } },
  });
  await prisma.category.deleteMany({
    where: { id: { in: resources.categoryIds } },
  });
}

function futureDate(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
