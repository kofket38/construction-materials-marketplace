import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  OrderStatus,
  PaymentMethod,
  Prisma,
  PrismaClient,
} from "../src/prisma/generated/client.js";
import {
  InsufficientProductStockError,
  SellerInventoryNotFoundError,
} from "../src/repositories/order.errors.js";
import { PrismaOrderRepository } from "../src/repositories/prisma-order.repository.js";
import { PrismaSellerDashboardRepository } from "../src/repositories/prisma-seller-dashboard.repository.js";
import { SellerOrderStateChangedError } from "../src/repositories/seller-dashboard.errors.js";
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

interface InventoryScenario {
  customerId: string;
  productId: string;
  sellerId: string;
}

describe.sequential("Inventory synchronization PostgreSQL integration", () => {
  let prisma: PrismaClient;
  let secondPrisma: PrismaClient;
  let orders: PrismaOrderRepository;
  let secondOrders: PrismaOrderRepository;
  let sellerDashboard: PrismaSellerDashboardRepository;
  let resources: TestResources;

  beforeAll(() => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is required for PostgreSQL integration tests.",
      );
    }

    prisma = createPrismaClient(connectionString);
    secondPrisma = createPrismaClient(connectionString);
    orders = new PrismaOrderRepository(prisma);
    secondOrders = new PrismaOrderRepository(secondPrisma);
    sellerDashboard = new PrismaSellerDashboardRepository(prisma);
  });

  afterEach(async () => {
    await cleanupResources(prisma, resources);
  });

  afterAll(async () => {
    await Promise.all([prisma.$disconnect(), secondPrisma.$disconnect()]);
  });

  // ─── Core reservation ──────────────────────────────────────────────────────

  it("reserves SellerInventory stock when an order is created", async () => {
    resources = emptyResources();
    const scenario = await seedInventoryScenario(prisma, resources, 10);

    const order = await createOrder(orders, scenario, 3);

    // SellerInventory decremented; Product.quantity untouched.
    await expectSellerInventoryQuantity(prisma, scenario.sellerId, scenario.productId, 7);
    await expectProductQuantity(prisma, scenario.productId, 99_999);
    await expectInventoryChanges(prisma, order.id, [-3]);
  });

  it("InventoryTransaction carries correct sellerId and city", async () => {
    resources = emptyResources();
    const scenario = await seedInventoryScenario(prisma, resources, 5);

    const order = await createOrder(orders, scenario, 2);

    const txn = await prisma.inventoryTransaction.findFirstOrThrow({
      where: { orderId: order.id },
      select: { sellerId: true, city: true },
    });
    expect(txn.sellerId).toBe(scenario.sellerId);
    expect(txn.city).toBe("Addis Ababa");
  });

  it("reserves the last available item without making SellerInventory negative", async () => {
    resources = emptyResources();
    const scenario = await seedInventoryScenario(prisma, resources, 1);

    await createOrder(orders, scenario, 1);

    await expectSellerInventoryQuantity(prisma, scenario.sellerId, scenario.productId, 0);
    await expect(
      createOrder(secondOrders, scenario, 1),
    ).rejects.toBeInstanceOf(InsufficientProductStockError);
    await expectSellerInventoryQuantity(prisma, scenario.sellerId, scenario.productId, 0);
  });

  it("rejects zero SellerInventory stock without creating an order", async () => {
    resources = emptyResources();
    const scenario = await seedInventoryScenario(prisma, resources, 0);

    await expect(createOrder(orders, scenario, 1)).rejects.toBeInstanceOf(
      InsufficientProductStockError,
    );

    await expectSellerInventoryQuantity(prisma, scenario.sellerId, scenario.productId, 0);
    await expect(
      prisma.order.count({ where: { customerId: scenario.customerId } }),
    ).resolves.toBe(0);
  });

  it("rejects order when SellerInventory row does not exist for the given seller", async () => {
    resources = emptyResources();
    const scenario = await seedInventoryScenario(prisma, resources, 10);
    const wrongSellerId = randomUUID();

    await expect(
      orders.create({
        customerId: scenario.customerId,
        items: [{ productId: scenario.productId, sellerId: wrongSellerId, quantity: 1 }],
        paymentMethod: "CASH_ON_DELIVERY",
        shipping,
        status: "PENDING_CONFIRMATION",
      }),
    ).rejects.toBeInstanceOf(SellerInventoryNotFoundError);

    // SellerInventory of the real seller untouched.
    await expectSellerInventoryQuantity(prisma, scenario.sellerId, scenario.productId, 10);
    await expectProductQuantity(prisma, scenario.productId, 99_999);
  });

  it("supports large quantity reservations", async () => {
    resources = emptyResources();
    const scenario = await seedInventoryScenario(prisma, resources, 1_000_000);

    const order = await createOrder(orders, scenario, 750_000);

    await expectSellerInventoryQuantity(prisma, scenario.sellerId, scenario.productId, 250_000);
    await expectProductQuantity(prisma, scenario.productId, 99_999);
    await expectInventoryChanges(prisma, order.id, [-750_000]);
  });

  it("prevents concurrent orders from overselling shared SellerInventory", async () => {
    resources = emptyResources();
    const scenario = await seedInventoryScenario(prisma, resources, 10);

    const attempts = await Promise.allSettled([
      createOrder(orders, scenario, 6),
      createOrder(secondOrders, scenario, 6),
    ]);

    const fulfilled = attempts.filter((attempt) => attempt.status === "fulfilled");
    const rejected = attempts.filter((attempt) => attempt.status === "rejected");

    // Under a remote/cloud database (e.g. Supabase), serialization pressure may
    // cause both concurrent transactions to abort rather than exactly one winning.
    // Either outcome (1 success + 1 failure, or 0 success + 2 failures) is correct
    // from an oversell-prevention standpoint — the invariant is that no more than
    // one order was created and SellerInventory was never over-decremented.
    expect(fulfilled.length).toBeLessThanOrEqual(1);
    expect(rejected.length).toBeGreaterThanOrEqual(1);

    const orderCount = await prisma.order.count({ where: { customerId: scenario.customerId } });
    const inventoryRow = await prisma.sellerInventory.findUniqueOrThrow({
      where: { sellerId_productId: { sellerId: scenario.sellerId, productId: scenario.productId } },
      select: { quantity: true },
    });
    const inventoryAfter = inventoryRow.quantity;

    // At most one order was placed — no oversell.
    expect(orderCount).toBeLessThanOrEqual(1);

    if (orderCount === 1) {
      // One succeeded: inventory was decremented by exactly 6.
      expect(inventoryAfter).toBe(4);
    } else {
      // Both failed (serialization conflict): inventory is unchanged.
      expect(inventoryAfter).toBe(10);
    }
    // Product.quantity must remain untouched (SellerInventory is authoritative).
    await expectProductQuantity(prisma, scenario.productId, 99_999);
  });

  it("rolls back all SellerInventory reservations when a later order item fails", async () => {
    resources = emptyResources();
    const scenario = await seedInventoryScenario(prisma, resources, 10);
    const secondProductId = await seedProductWithInventory(
      prisma,
      resources,
      scenario.sellerId,
      1,
      "Rollback product",
    );

    await expect(
      orders.create({
        customerId: scenario.customerId,
        items: [
          { productId: scenario.productId, sellerId: scenario.sellerId, quantity: 4 },
          { productId: secondProductId, sellerId: scenario.sellerId, quantity: 2 },
        ],
        paymentMethod: "CASH_ON_DELIVERY",
        shipping,
        status: "PENDING_CONFIRMATION",
      }),
    ).rejects.toBeInstanceOf(InsufficientProductStockError);

    await expectSellerInventoryQuantity(prisma, scenario.sellerId, scenario.productId, 10);
    await expectSellerInventoryQuantity(prisma, scenario.sellerId, secondProductId, 1);
    await expectProductQuantity(prisma, scenario.productId, 99_999);
    await expect(
      prisma.order.count({ where: { customerId: scenario.customerId } }),
    ).resolves.toBe(0);
    await expect(
      prisma.inventoryTransaction.count({
        where: { productId: { in: [scenario.productId, secondProductId] } },
      }),
    ).resolves.toBe(0);
  });

  // ─── Cross-seller / cross-city isolation ───────────────────────────────────

  it("one seller's SellerInventory is not affected by another seller's order", async () => {
    resources = emptyResources();
    const scenarioA = await seedInventoryScenario(prisma, resources, 10);
    // Second seller for the same product is a separate SellerInventory row.
    const sellerB = await prisma.user.create({
      data: {
        name: "Seller B",
        email: `seller-b-${randomUUID()}@example.com`,
        passwordHash: "hash",
        role: "SELLER",
        emailVerified: true,
      },
    });
    resources.userIds.push(sellerB.id);

    await prisma.sellerInventory.create({
      data: {
        sellerId: sellerB.id,
        productId: scenarioA.productId,
        price: new Prisma.Decimal("30.00"),
        quantity: 20,
        city: "Dire Dawa",
      },
    });

    // Customer orders from Seller A.
    await createOrder(orders, scenarioA, 3);

    // Seller A inventory decremented.
    await expectSellerInventoryQuantity(prisma, scenarioA.sellerId, scenarioA.productId, 7);
    // Seller B inventory untouched.
    await expectSellerInventoryQuantity(prisma, sellerB.id, scenarioA.productId, 20);
    // Product.quantity untouched.
    await expectProductQuantity(prisma, scenarioA.productId, 99_999);
  });

  it("ordering from city A does not affect inventory recorded for city B", async () => {
    resources = emptyResources();
    // One seller, two cities — requires two SellerInventory rows.
    // The schema has @@unique([sellerId, productId]) so one product/seller
    // can only have one city row. Use two different products to model this.
    const suffix = randomUUID();
    const customer = await prisma.user.create({
      data: {
        name: "City Isolation Customer",
        email: `city-customer-${suffix}@example.com`,
        passwordHash: "hash",
        role: "CUSTOMER",
        emailVerified: true,
      },
    });
    resources.userIds.push(customer.id);

    const seller = await prisma.user.create({
      data: {
        name: "City Isolation Seller",
        email: `city-seller-${suffix}@example.com`,
        passwordHash: "hash",
        role: "SELLER",
        emailVerified: true,
      },
    });
    resources.userIds.push(seller.id);

    const category = await prisma.category.create({
      data: { name: `City Isolation Category ${suffix}` },
    });
    resources.categoryIds.push(category.id);

    // Product for Addis Ababa inventory.
    const productAddis = await prisma.product.create({
      data: {
        sellerId: seller.id,
        categoryId: category.id,
        name: "City Isolation Product Addis",
        description: "Addis inventory",
        price: new Prisma.Decimal("10.00"),
        quantity: 100,
      },
    });

    await prisma.sellerInventory.create({
      data: {
        sellerId: seller.id,
        productId: productAddis.id,
        price: new Prisma.Decimal("10.00"),
        quantity: 15,
        city: "Addis Ababa",
      },
    });

    // Product for Dire Dawa inventory.
    const productDireDawa = await prisma.product.create({
      data: {
        sellerId: seller.id,
        categoryId: category.id,
        name: "City Isolation Product Dire Dawa",
        description: "Dire Dawa inventory",
        price: new Prisma.Decimal("10.00"),
        quantity: 100,
      },
    });

    await prisma.sellerInventory.create({
      data: {
        sellerId: seller.id,
        productId: productDireDawa.id,
        price: new Prisma.Decimal("10.00"),
        quantity: 20,
        city: "Dire Dawa",
      },
    });

    // Order from Addis product.
    await orders.create({
      customerId: customer.id,
      items: [{ productId: productAddis.id, sellerId: seller.id, quantity: 4 }],
      paymentMethod: "CASH_ON_DELIVERY",
      shipping,
      status: "PENDING_CONFIRMATION",
    });

    // Addis inventory decremented.
    await expectSellerInventoryQuantity(prisma, seller.id, productAddis.id, 11);
    // Dire Dawa inventory untouched.
    await expectSellerInventoryQuantity(prisma, seller.id, productDireDawa.id, 20);
  });

  // ─── Payment verification ──────────────────────────────────────────────────

  it("keeps payment approval at exactly one SellerInventory deduction", async () => {
    resources = emptyResources();
    const scenario = await seedInventoryScenario(prisma, resources, 10);
    const order = await createManualPaymentOrder(prisma, orders, scenario, 2);

    const approved = await sellerDashboard.verifyPayment(
      scenario.sellerId,
      order.id,
      "APPROVE",
    );

    expect(approved?.status).toBe("CONFIRMED");
    expect(approved?.payment?.status).toBe("VERIFIED");
    await expectSellerInventoryQuantity(prisma, scenario.sellerId, scenario.productId, 8);
    await expectInventoryChanges(prisma, order.id, [-2]);
    await expect(
      sellerDashboard.verifyPayment(
        scenario.sellerId,
        order.id,
        "APPROVE",
      ),
    ).rejects.toBeInstanceOf(SellerOrderStateChangedError);
    await expectSellerInventoryQuantity(prisma, scenario.sellerId, scenario.productId, 8);
    await expectInventoryChanges(prisma, order.id, [-2]);
  });

  it("restores SellerInventory when payment is rejected", async () => {
    resources = emptyResources();
    const scenario = await seedInventoryScenario(prisma, resources, 10);
    const order = await createManualPaymentOrder(prisma, orders, scenario, 3);

    const rejected = await sellerDashboard.verifyPayment(
      scenario.sellerId,
      order.id,
      "REJECT",
    );

    expect(rejected?.status).toBe("PAYMENT_REJECTED");
    expect(rejected?.payment?.status).toBe("REJECTED");
    await expectSellerInventoryQuantity(prisma, scenario.sellerId, scenario.productId, 10);
    await expectProductQuantity(prisma, scenario.productId, 99_999);
    await expectInventoryChanges(prisma, order.id, [-3, 3]);
  });

  it("restoration is idempotent — double-cancel cannot increase stock twice", async () => {
    resources = emptyResources();
    const scenario = await seedInventoryScenario(prisma, resources, 10);
    const order = await createOrder(orders, scenario, 4);

    await expectSellerInventoryQuantity(prisma, scenario.sellerId, scenario.productId, 6);

    // First cancel restores stock.
    await orders.cancel(order.id, { onlyIfPending: true });
    await expectSellerInventoryQuantity(prisma, scenario.sellerId, scenario.productId, 10);

    // Attempting a second cancel throws (already cancelled), stock stays at 10.
    await expect(
      orders.cancel(order.id, { onlyIfPending: false }),
    ).rejects.toThrow();
    await expectSellerInventoryQuantity(prisma, scenario.sellerId, scenario.productId, 10);
    await expectInventoryChanges(prisma, order.id, [-4, 4]);
  });

  it("admin rejectPayment: restores SellerInventory and sets payment status REJECTED", async () => {
    resources = emptyResources();
    const scenario = await seedInventoryScenario(prisma, resources, 10);
    const order = await createManualPaymentOrder(prisma, orders, scenario, 3);

    const rejected = await orders.rejectPayment(order.id);

    expect(rejected?.status).toBe("PAYMENT_REJECTED");
    // SellerInventory restored to original quantity.
    await expectSellerInventoryQuantity(
      prisma,
      scenario.sellerId,
      scenario.productId,
      10,
    );
    await expectProductQuantity(prisma, scenario.productId, 99_999);
    // SHIPMENT (−3) + CANCELLATION (+3).
    await expectInventoryChanges(prisma, order.id, [-3, 3]);
    // Payment record must be REJECTED in the database.
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { orderId: order.id },
      select: { status: true, verifiedAt: true },
    });
    expect(payment.status).toBe("REJECTED");
    expect(payment.verifiedAt).toBeNull();
  });

  it("admin rejectPayment: second call on the same order throws (concurrent-modification guard)", async () => {
    resources = emptyResources();
    const scenario = await seedInventoryScenario(prisma, resources, 10);
    const order = await createManualPaymentOrder(prisma, orders, scenario, 2);

    // First rejection succeeds.
    const rejected = await orders.rejectPayment(order.id);
    expect(rejected?.status).toBe("PAYMENT_REJECTED");
    await expectSellerInventoryQuantity(
      prisma,
      scenario.sellerId,
      scenario.productId,
      10,
    );
    await expectInventoryChanges(prisma, order.id, [-2, 2]);

    // Second call must throw — order is no longer PENDING_PAYMENT_VERIFICATION.
    await expect(orders.rejectPayment(order.id)).rejects.toThrow();

    // Inventory and transaction count must be unchanged after the failed attempt.
    await expectSellerInventoryQuantity(
      prisma,
      scenario.sellerId,
      scenario.productId,
      10,
    );
    await expectInventoryChanges(prisma, order.id, [-2, 2]);
  });

  // ─── Fulfillment transitions ───────────────────────────────────────────────

  it("restores SellerInventory stock when an order is cancelled", async () => {
    resources = emptyResources();
    const scenario = await seedInventoryScenario(prisma, resources, 10);
    const order = await createOrder(orders, scenario, 4);

    await orders.cancel(order.id, { onlyIfPending: true });

    await expectSellerInventoryQuantity(prisma, scenario.sellerId, scenario.productId, 10);
    await expectProductQuantity(prisma, scenario.productId, 99_999);
    await expectInventoryChanges(prisma, order.id, [-4, 4]);
  });

  it("does not deduct SellerInventory again during fulfillment transitions", async () => {
    resources = emptyResources();
    const scenario = await seedInventoryScenario(prisma, resources, 10);
    const order = await createOrder(orders, scenario, 2);

    for (const [expectedStatus, status] of [
      ["PENDING_CONFIRMATION", "CONFIRMED"],
      ["CONFIRMED", "PROCESSING"],
      ["PROCESSING", "SHIPPED"],
      ["SHIPPED", "DELIVERED"],
    ] as const) {
      await sellerDashboard.updateOrderStatus(
        scenario.sellerId,
        order.id,
        expectedStatus,
        status,
      );
      await expectSellerInventoryQuantity(prisma, scenario.sellerId, scenario.productId, 8);
      await expectInventoryChanges(prisma, order.id, [-2]);
    }
  });

  it("exposes seller fulfillment updates through the buyer order repository", async () => {
    resources = emptyResources();
    const scenario = await seedInventoryScenario(prisma, resources, 10);
    const order = await createOrder(orders, scenario, 2);

    await sellerDashboard.updateOrderStatus(
      scenario.sellerId,
      order.id,
      "PENDING_CONFIRMATION",
      "CONFIRMED",
    );

    const buyerOrder = await orders.findById(order.id);
    expect(buyerOrder).toMatchObject({
      id: order.id,
      customerId: scenario.customerId,
      status: "CONFIRMED",
    });
  });
});

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const shipping = {
  fullName: "Inventory Test Customer",
  phone: "+251911000000",
  city: "Addis Ababa",
  address: "Inventory synchronization test address",
};

function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

function emptyResources(): TestResources {
  return { userIds: [], categoryIds: [] };
}

async function seedInventoryScenario(
  prisma: PrismaClient,
  resources: TestResources,
  quantity: number,
): Promise<InventoryScenario> {
  const suffix = randomUUID();
  const customer = await prisma.user.create({
    data: {
      name: "Inventory Test Customer",
      email: `inventory-customer-${suffix}@example.com`,
      passwordHash: "integration-test-password-hash",
      role: "CUSTOMER",
      emailVerified: true,
    },
  });
  resources.userIds.push(customer.id);

  const seller = await prisma.user.create({
    data: {
      name: "Inventory Test Seller",
      email: `inventory-seller-${suffix}@example.com`,
      passwordHash: "integration-test-password-hash",
      role: "SELLER",
      emailVerified: true,
    },
  });
  resources.userIds.push(seller.id);

  const productId = await seedProductWithInventory(
    prisma,
    resources,
    seller.id,
    quantity,
    "Inventory test product",
  );

  return { customerId: customer.id, productId, sellerId: seller.id };
}

async function seedProductWithInventory(
  prisma: PrismaClient,
  resources: TestResources,
  sellerId: string,
  quantity: number,
  name: string,
): Promise<string> {
  const category = await prisma.category.create({
    data: { name: `${name} category ${randomUUID()}` },
  });
  resources.categoryIds.push(category.id);

  // Product.price/quantity are legacy catalog fields — NOT used by checkout.
  const product = await prisma.product.create({
    data: {
      sellerId,
      categoryId: category.id,
      name,
      description: `${name} description`,
      price: new Prisma.Decimal("999.00"),
      quantity: 99_999,
    },
  });

  // SellerInventory is the authoritative source for price and stock.
  await prisma.sellerInventory.create({
    data: {
      sellerId,
      productId: product.id,
      price: new Prisma.Decimal("25.00"),
      quantity,
      city: "Addis Ababa",
    },
  });

  return product.id;
}

function createOrder(
  repository: PrismaOrderRepository,
  scenario: InventoryScenario,
  quantity: number,
) {
  return repository.create({
    customerId: scenario.customerId,
    items: [{ productId: scenario.productId, sellerId: scenario.sellerId, quantity }],
    paymentMethod: "CASH_ON_DELIVERY",
    shipping,
    status: "PENDING_CONFIRMATION",
  });
}

async function createManualPaymentOrder(
  prisma: PrismaClient,
  repository: PrismaOrderRepository,
  scenario: InventoryScenario,
  quantity: number,
) {
  const order = await repository.create({
    customerId: scenario.customerId,
    items: [{ productId: scenario.productId, sellerId: scenario.sellerId, quantity }],
    paymentMethod: "CBE_BANK",
    shipping,
    status: "PENDING_PAYMENT",
  });

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        orderId: order.id,
        method: PaymentMethod.CBE_BANK,
        providerName: "CBE Bank",
        proofImageUrl: `${order.id}.png`,
      },
    }),
    prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.PENDING_PAYMENT_VERIFICATION },
    }),
  ]);

  return order;
}

async function expectProductQuantity(
  prisma: PrismaClient,
  productId: string,
  quantity: number,
): Promise<void> {
  await expect(
    prisma.product.findUniqueOrThrow({
      where: { id: productId },
      select: { quantity: true },
    }),
  ).resolves.toEqual({ quantity });
}

async function expectSellerInventoryQuantity(
  prisma: PrismaClient,
  sellerId: string,
  productId: string,
  quantity: number,
): Promise<void> {
  await expect(
    prisma.sellerInventory.findUniqueOrThrow({
      where: { sellerId_productId: { sellerId, productId } },
      select: { quantity: true },
    }),
  ).resolves.toEqual({ quantity });
}

async function expectInventoryChanges(
  prisma: PrismaClient,
  orderId: string,
  quantityChanges: number[],
): Promise<void> {
  const transactions = await prisma.inventoryTransaction.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
    select: { quantityChange: true },
  });

  expect(
    transactions
      .map((t) => t.quantityChange)
      .sort((a, b) => a - b),
  ).toEqual([...quantityChanges].sort((a, b) => a - b));
}

async function cleanupResources(
  prisma: PrismaClient,
  resources: TestResources | undefined,
): Promise<void> {
  if (!resources || resources.userIds.length === 0) {
    return;
  }

  await prisma.order.deleteMany({
    where: { customerId: { in: resources.userIds } },
  });
  await prisma.sellerInventory.deleteMany({
    where: { sellerId: { in: resources.userIds } },
  });
  await prisma.product.deleteMany({
    where: { sellerId: { in: resources.userIds } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: resources.userIds } },
  });
  await prisma.category.deleteMany({
    where: { id: { in: resources.categoryIds } },
  });
}
