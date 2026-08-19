import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/prisma/generated/client.js";
import {
  SellerInventoryNotFoundError,
} from "../src/repositories/order.errors.js";
import { PrismaOrderRepository } from "../src/repositories/prisma-order.repository.js";
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

interface OrderScenario {
  customerId: string;
  productId: string;
  sellerId: string;
  orderId: string;
}

describe.sequential("PrismaOrderRepository PostgreSQL integration", () => {
  let prisma: PrismaClient;
  let secondPrisma: PrismaClient;
  let repository: PrismaOrderRepository;
  let secondRepository: PrismaOrderRepository;
  let resources: TestResources;

  beforeAll(() => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for PostgreSQL integration tests.");
    }

    prisma = createPrismaClient(connectionString);
    secondPrisma = createPrismaClient(connectionString);
    repository = new PrismaOrderRepository(prisma);
    secondRepository = new PrismaOrderRepository(secondPrisma);
  });

  afterEach(async () => {
    await cleanupResources(prisma, resources);
  });

  afterAll(async () => {
    await Promise.all([prisma.$disconnect(), secondPrisma.$disconnect()]);
  });

  it("persists payment and shipping details", async () => {
    resources = emptyResources();
    const scenario = await seedOrderScenario(prisma, repository, resources);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: scenario.orderId },
      select: {
        paymentMethod: true,
        shippingFullName: true,
        shippingPhone: true,
        shippingCity: true,
        shippingAddress: true,
        shippingNotes: true,
      },
    });

    expect(order).toEqual({
      paymentMethod: "CASH_ON_DELIVERY",
      shippingFullName: "Order Integration Customer",
      shippingPhone: "+251911000000",
      shippingCity: "Addis Ababa",
      shippingAddress: "Integration test delivery address",
      shippingNotes: "Leave materials at the marked unloading zone.",
    });
  });

  it("uses SellerInventory price and deducts SellerInventory quantity on creation", async () => {
    resources = emptyResources();
    const scenario = await seedOrderScenario(prisma, repository, resources);

    // Product.quantity must be untouched.
    await expectProductQuantity(prisma, scenario.productId, 10);
    // SellerInventory quantity was 10, 2 were reserved.
    await expectSellerInventoryQuantity(prisma, scenario.sellerId, scenario.productId, 8);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: scenario.orderId },
      include: { items: true },
    });
    // Price must come from SellerInventory (25.00), not a different value.
    expect(order.items[0]!.unitPrice.toFixed(2)).toBe("25.00");
    expect(order.totalAmount.toFixed(2)).toBe("50.00");
  });

  it("InventoryTransaction records sellerId and city", async () => {
    resources = emptyResources();
    const scenario = await seedOrderScenario(prisma, repository, resources);

    const txn = await prisma.inventoryTransaction.findFirstOrThrow({
      where: { orderId: scenario.orderId },
      select: { sellerId: true, city: true, quantityChange: true },
    });

    expect(txn.sellerId).toBe(scenario.sellerId);
    expect(txn.city).toBe("Addis Ababa");
    expect(txn.quantityChange).toBe(-2);
  });

  it("rejects order creation when SellerInventory does not exist", async () => {
    resources = emptyResources();
    const suffix = randomUUID();

    const customer = await prisma.user.create({
      data: {
        name: "NoInv Customer",
        email: `no-inv-customer-${suffix}@example.com`,
        passwordHash: "hash",
        role: "CUSTOMER",
        emailVerified: true,
      },
    });
    resources.userIds.push(customer.id);

    const seller = await prisma.user.create({
      data: {
        name: "NoInv Seller",
        email: `no-inv-seller-${suffix}@example.com`,
        passwordHash: "hash",
        role: "SELLER",
        emailVerified: true,
      },
    });
    resources.userIds.push(seller.id);

    const category = await prisma.category.create({
      data: { name: `NoInv Category ${suffix}` },
    });
    resources.categoryIds.push(category.id);

    const product = await prisma.product.create({
      data: {
        sellerId: seller.id,
        categoryId: category.id,
        name: "NoInv Product",
        description: "Product with no SellerInventory row",
        price: new Prisma.Decimal("99.00"),
        quantity: 100,
      },
    });

    // Deliberately do NOT create a SellerInventory row.
    const wrongSellerId = randomUUID();

    await expect(
      repository.create({
        customerId: customer.id,
        items: [{ productId: product.id, sellerId: wrongSellerId, quantity: 1 }],
        paymentMethod: "CASH_ON_DELIVERY",
        shipping,
        status: "PENDING_CONFIRMATION",
      }),
    ).rejects.toBeInstanceOf(SellerInventoryNotFoundError);

    // Product.quantity must be completely untouched.
    await expectProductQuantity(prisma, product.id, 100);
  });

  it("does not restore sold stock when a delivered order is cancelled", async () => {
    resources = emptyResources();
    const scenario = await seedOrderScenario(prisma, repository, resources);

    await repository.updateStatus(scenario.orderId, "DELIVERED");
    const cancelled = await repository.cancel(scenario.orderId, {
      onlyIfPending: false,
    });

    expect(cancelled).toMatchObject({
      id: scenario.orderId,
      status: "CANCELLED",
    });
    // SellerInventory must not be restored for delivered orders.
    await expectSellerInventoryQuantity(prisma, scenario.sellerId, scenario.productId, 8);
    await expectInventoryTransactionCount(prisma, scenario.orderId, 1);
  });

  it("does not deduct reserved inventory again at shipment", async () => {
    resources = emptyResources();
    const scenario = await seedOrderScenario(prisma, repository, resources);

    const shipped = await repository.updateStatus(scenario.orderId, "SHIPPED");

    expect(shipped?.status).toBe("SHIPPED");
    await expectSellerInventoryQuantity(prisma, scenario.sellerId, scenario.productId, 8);
    await expectInventoryTransactionCount(prisma, scenario.orderId, 1);

    const repeated = await repository.updateStatus(scenario.orderId, "SHIPPED");

    expect(repeated?.status).toBe("SHIPPED");
    await expectSellerInventoryQuantity(prisma, scenario.sellerId, scenario.productId, 8);
    await expectInventoryTransactionCount(prisma, scenario.orderId, 1);
  });

  it("does not revalidate already-reserved stock at shipment", async () => {
    resources = emptyResources();
    const scenario = await seedOrderScenario(prisma, repository, resources);

    // Drop SellerInventory quantity to 0 after reservation — should not matter.
    await prisma.sellerInventory.updateMany({
      where: { sellerId: scenario.sellerId, productId: scenario.productId },
      data: { quantity: 0 },
    });

    const shipped = await repository.updateStatus(scenario.orderId, "SHIPPED");

    expect(shipped?.status).toBe("SHIPPED");
    await expectInventoryTransactionCount(prisma, scenario.orderId, 1);
  });

  it("restores SellerInventory quantity exactly once under concurrent cancellation", async () => {
    resources = emptyResources();
    const scenario = await seedOrderScenario(prisma, repository, resources);

    await repository.updateStatus(scenario.orderId, "SHIPPED");
    await expectSellerInventoryQuantity(prisma, scenario.sellerId, scenario.productId, 8);
    await expectInventoryTransactionCount(prisma, scenario.orderId, 1);

    const attempts = await Promise.allSettled([
      repository.cancel(scenario.orderId, { onlyIfPending: false }),
      secondRepository.cancel(scenario.orderId, { onlyIfPending: false }),
    ]);

    expect(
      attempts.filter((attempt) => attempt.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      attempts.filter((attempt) => attempt.status === "rejected"),
    ).toHaveLength(1);
    await expectSellerInventoryQuantity(prisma, scenario.sellerId, scenario.productId, 10);
    await expectOrderStatus(prisma, scenario.orderId, "CANCELLED");
    await expectInventoryTransactionCount(prisma, scenario.orderId, 2);

    // Product.quantity must remain untouched throughout.
    await expectProductQuantity(prisma, scenario.productId, 10);
  });
});

const shipping = {
  fullName: "Order Integration Customer",
  phone: "+251911000000",
  city: "Addis Ababa",
  address: "Integration test delivery address",
  notes: "Leave materials at the marked unloading zone.",
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

async function seedOrderScenario(
  prisma: PrismaClient,
  repository: PrismaOrderRepository,
  resources: TestResources,
): Promise<OrderScenario> {
  const suffix = randomUUID();
  const customer = await prisma.user.create({
    data: {
      name: "Order Integration Customer",
      email: `order-customer-${suffix}@example.com`,
      passwordHash: "integration-test-password-hash",
      role: "CUSTOMER",
      emailVerified: true,
    },
  });
  resources.userIds.push(customer.id);

  const seller = await prisma.user.create({
    data: {
      name: "Order Integration Seller",
      email: `order-seller-${suffix}@example.com`,
      passwordHash: "integration-test-password-hash",
      role: "SELLER",
      emailVerified: true,
    },
  });
  resources.userIds.push(seller.id);

  const category = await prisma.category.create({
    data: {
      name: `Order Integration Category ${suffix}`,
    },
  });
  resources.categoryIds.push(category.id);

  const product = await prisma.product.create({
    data: {
      sellerId: seller.id,
      categoryId: category.id,
      name: "Order Integration Product",
      description: "Product used by order integration tests.",
      // Legacy field kept for catalog display; NOT used by checkout.
      price: new Prisma.Decimal("99.00"),
      quantity: 10,
    },
  });

  // SellerInventory is the authoritative source for price and stock.
  await prisma.sellerInventory.create({
    data: {
      sellerId: seller.id,
      productId: product.id,
      price: new Prisma.Decimal("25.00"),
      quantity: 10,
      city: "Addis Ababa",
    },
  });

  const order = await repository.create({
    customerId: customer.id,
    items: [{ productId: product.id, sellerId: seller.id, quantity: 2 }],
    paymentMethod: "CASH_ON_DELIVERY",
    shipping,
    status: "PENDING_CONFIRMATION",
  });

  expect(order.status).toBe("PENDING_CONFIRMATION");
  // Product.quantity must remain untouched by checkout.
  await expectProductQuantity(prisma, product.id, 10);
  await expectSellerInventoryQuantity(prisma, seller.id, product.id, 8);
  await expectInventoryTransactionCount(prisma, order.id, 1);

  return {
    customerId: customer.id,
    productId: product.id,
    sellerId: seller.id,
    orderId: order.id,
  };
}

async function expectProductQuantity(
  prisma: PrismaClient,
  productId: string,
  quantity: number,
): Promise<void> {
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    select: { quantity: true },
  });

  expect(product.quantity).toBe(quantity);
}

async function expectSellerInventoryQuantity(
  prisma: PrismaClient,
  sellerId: string,
  productId: string,
  quantity: number,
): Promise<void> {
  const inv = await prisma.sellerInventory.findUniqueOrThrow({
    where: { sellerId_productId: { sellerId, productId } },
    select: { quantity: true },
  });

  expect(inv.quantity).toBe(quantity);
}

async function expectOrderStatus(
  prisma: PrismaClient,
  orderId: string,
  status: "PENDING_CONFIRMATION" | "CANCELLED",
): Promise<void> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { status: true },
  });

  expect(order.status).toBe(status);
}

async function expectInventoryTransactionCount(
  prisma: PrismaClient,
  orderId: string,
  count: number,
): Promise<void> {
  await expect(
    prisma.inventoryTransaction.count({ where: { orderId } }),
  ).resolves.toBe(count);
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
