import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  OrderStatus,
  PaymentMethod,
  Prisma,
  PrismaClient,
} from "../src/prisma/generated/client.js";
import { InsufficientProductStockError } from "../src/repositories/order.errors.js";
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

  it("reserves stock when an order is created", async () => {
    resources = emptyResources();
    const scenario = await seedInventoryScenario(prisma, resources, 10);

    const order = await createOrder(orders, scenario, 3);

    await expectProductQuantity(prisma, scenario.productId, 7);
    await expectInventoryChanges(prisma, order.id, [-3]);
  });

  it("reserves the last available item without making inventory negative", async () => {
    resources = emptyResources();
    const scenario = await seedInventoryScenario(prisma, resources, 1);

    await createOrder(orders, scenario, 1);

    await expectProductQuantity(prisma, scenario.productId, 0);
    await expect(
      createOrder(secondOrders, scenario, 1),
    ).rejects.toBeInstanceOf(InsufficientProductStockError);
    await expectProductQuantity(prisma, scenario.productId, 0);
  });

  it("rejects zero stock without creating an order", async () => {
    resources = emptyResources();
    const scenario = await seedInventoryScenario(prisma, resources, 0);

    await expect(createOrder(orders, scenario, 1)).rejects.toBeInstanceOf(
      InsufficientProductStockError,
    );

    await expectProductQuantity(prisma, scenario.productId, 0);
    await expect(
      prisma.order.count({ where: { customerId: scenario.customerId } }),
    ).resolves.toBe(0);
  });

  it("supports large quantity reservations", async () => {
    resources = emptyResources();
    const scenario = await seedInventoryScenario(
      prisma,
      resources,
      1_000_000,
    );

    const order = await createOrder(orders, scenario, 750_000);

    await expectProductQuantity(prisma, scenario.productId, 250_000);
    await expectInventoryChanges(prisma, order.id, [-750_000]);
  });

  it("prevents concurrent orders from overselling shared inventory", async () => {
    resources = emptyResources();
    const scenario = await seedInventoryScenario(prisma, resources, 10);

    const attempts = await Promise.allSettled([
      createOrder(orders, scenario, 6),
      createOrder(secondOrders, scenario, 6),
    ]);

    expect(
      attempts.filter((attempt) => attempt.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      attempts.filter((attempt) => attempt.status === "rejected"),
    ).toHaveLength(1);
    await expectProductQuantity(prisma, scenario.productId, 4);
    await expect(
      prisma.order.count({ where: { customerId: scenario.customerId } }),
    ).resolves.toBe(1);
  });

  it("rolls back all reservations when a later order item fails", async () => {
    resources = emptyResources();
    const scenario = await seedInventoryScenario(prisma, resources, 10);
    const secondProductId = await seedProduct(
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
          { productId: scenario.productId, quantity: 4 },
          { productId: secondProductId, quantity: 2 },
        ],
        paymentMethod: "CASH_ON_DELIVERY",
        shipping,
        status: "PENDING_CONFIRMATION",
      }),
    ).rejects.toBeInstanceOf(InsufficientProductStockError);

    await expectProductQuantity(prisma, scenario.productId, 10);
    await expectProductQuantity(prisma, secondProductId, 1);
    await expect(
      prisma.order.count({ where: { customerId: scenario.customerId } }),
    ).resolves.toBe(0);
    await expect(
      prisma.inventoryTransaction.count({
        where: { productId: { in: [scenario.productId, secondProductId] } },
      }),
    ).resolves.toBe(0);
  });

  it("keeps payment approval at exactly one inventory deduction", async () => {
    resources = emptyResources();
    const scenario = await seedInventoryScenario(prisma, resources, 10);
    const order = await createManualPaymentOrder(
      prisma,
      orders,
      scenario,
      2,
    );

    const approved = await sellerDashboard.verifyPayment(
      scenario.sellerId,
      order.id,
      "APPROVE",
    );

    expect(approved?.status).toBe("CONFIRMED");
    expect(approved?.payment?.status).toBe("VERIFIED");
    await expectProductQuantity(prisma, scenario.productId, 8);
    await expectInventoryChanges(prisma, order.id, [-2]);
    await expect(
      sellerDashboard.verifyPayment(
        scenario.sellerId,
        order.id,
        "APPROVE",
      ),
    ).rejects.toBeInstanceOf(SellerOrderStateChangedError);
    await expectProductQuantity(prisma, scenario.productId, 8);
    await expectInventoryChanges(prisma, order.id, [-2]);
  });

  it("restores reserved inventory when payment is rejected", async () => {
    resources = emptyResources();
    const scenario = await seedInventoryScenario(prisma, resources, 10);
    const order = await createManualPaymentOrder(
      prisma,
      orders,
      scenario,
      3,
    );

    const rejected = await sellerDashboard.verifyPayment(
      scenario.sellerId,
      order.id,
      "REJECT",
    );

    expect(rejected?.status).toBe("PAYMENT_REJECTED");
    expect(rejected?.payment?.status).toBe("REJECTED");
    await expectProductQuantity(prisma, scenario.productId, 10);
    await expectInventoryChanges(prisma, order.id, [-3, 3]);
  });

  it("restores reserved inventory when an order is cancelled", async () => {
    resources = emptyResources();
    const scenario = await seedInventoryScenario(prisma, resources, 10);
    const order = await createOrder(orders, scenario, 4);

    await orders.cancel(order.id, { onlyIfPending: true });

    await expectProductQuantity(prisma, scenario.productId, 10);
    await expectInventoryChanges(prisma, order.id, [-4, 4]);
  });

  it("does not deduct inventory again during fulfillment transitions", async () => {
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
      await expectProductQuantity(prisma, scenario.productId, 8);
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
  return {
    userIds: [],
    categoryIds: [],
  };
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

  const productId = await seedProduct(
    prisma,
    resources,
    seller.id,
    quantity,
    "Inventory test product",
  );

  return {
    customerId: customer.id,
    productId,
    sellerId: seller.id,
  };
}

async function seedProduct(
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

  const product = await prisma.product.create({
    data: {
      sellerId,
      categoryId: category.id,
      name,
      description: `${name} description`,
      price: new Prisma.Decimal("25.00"),
      quantity,
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
    items: [{ productId: scenario.productId, quantity }],
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
    items: [{ productId: scenario.productId, quantity }],
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
        proofImageUrl: `/uploads/payment-proofs/${order.id}.png`,
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
      .map((transaction) => transaction.quantityChange)
      .sort((left, right) => left - right),
  ).toEqual([...quantityChanges].sort((left, right) => left - right));
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
