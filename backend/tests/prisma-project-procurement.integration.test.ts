import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/prisma/generated/client.js";
import { PrismaProjectRepository } from "../src/repositories/prisma-project.repository.js";
import { ProjectHasProcurementError } from "../src/repositories/project.errors.js";
import { SETTLED_ORDER_STATUSES } from "../src/repositories/project.repository.js";
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

interface ProcurementScenario {
  ownerId: string;
  sellerId: string;
  productId: string;
  projectId: string;
}

// findProcurement orders by (createdAt desc, id asc). Leaving createdAt to the
// database default would make the ordering assertions depend on a random-UUID
// tie-break whenever two rows land in the same microsecond, so every seeded row
// gets an explicit, distinct timestamp.
const OLDER = new Date("2026-01-10T08:00:00.000Z");
const NEWER = new Date("2026-02-20T09:30:00.000Z");
const EXPIRED_AT = new Date(Date.now() - 60 * 60 * 1000);
const EXPIRES_AT = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

describe.sequential(
  "PrismaProjectRepository procurement PostgreSQL integration",
  () => {
    let prisma: PrismaClient;
    let repository: PrismaProjectRepository;
    let resources: TestResources;

    beforeAll(() => {
      const connectionString = process.env.DATABASE_URL;
      if (!connectionString) {
        throw new Error(
          "DATABASE_URL is required for PostgreSQL integration tests.",
        );
      }

      prisma = createPrismaClient(connectionString);
      repository = new PrismaProjectRepository(prisma);
    });

    afterEach(async () => {
      await cleanupResources(prisma, resources);
    });

    afterAll(async () => {
      await prisma.$disconnect();
    });

    // ── ON DELETE RESTRICT → P2003 → ProjectHasProcurementError ─────────────
    // The service turns ProjectHasProcurementError into a 409. Unit tests can
    // only assert the mapping from a mocked error code, so these two cases are
    // the only proof that PostgreSQL's RESTRICT violation actually reaches
    // Prisma as P2003 rather than some other code (a 500 to the client).

    it("refuses to delete a project while an RFQ still points at it", async () => {
      resources = emptyResources();
      const scenario = await seedScenario(prisma, resources);
      await createRfq(prisma, scenario, { projectId: scenario.projectId });

      await expect(
        repository.delete(scenario.projectId, scenario.ownerId),
      ).rejects.toBeInstanceOf(ProjectHasProcurementError);

      await expect(
        prisma.project.count({ where: { id: scenario.projectId } }),
      ).resolves.toBe(1);
    });

    it("refuses to delete a project while an order still points at it", async () => {
      resources = emptyResources();
      const scenario = await seedScenario(prisma, resources);
      await createOrder(prisma, scenario, { projectId: scenario.projectId });

      await expect(
        repository.delete(scenario.projectId, scenario.ownerId),
      ).rejects.toBeInstanceOf(ProjectHasProcurementError);

      await expect(
        prisma.project.count({ where: { id: scenario.projectId } }),
      ).resolves.toBe(1);
    });

    it("deletes the project once every procurement link is cleared", async () => {
      resources = emptyResources();
      const scenario = await seedScenario(prisma, resources);
      const rfqId = await createRfq(prisma, scenario, {
        projectId: scenario.projectId,
      });
      const orderId = await createOrder(prisma, scenario, {
        projectId: scenario.projectId,
      });

      await expect(
        repository.delete(scenario.projectId, scenario.ownerId),
      ).rejects.toBeInstanceOf(ProjectHasProcurementError);

      await expect(
        repository.detachRfq(scenario.projectId, rfqId),
      ).resolves.toBe(true);
      await expect(
        repository.detachOrder(scenario.projectId, orderId),
      ).resolves.toBe(true);
      await expect(
        repository.delete(scenario.projectId, scenario.ownerId),
      ).resolves.toBe(true);

      // Detaching clears the link without destroying procurement history: the
      // RFQ and the order outlive the project they were attached to.
      await expect(
        prisma.project.count({ where: { id: scenario.projectId } }),
      ).resolves.toBe(0);
      await expect(projectIdOfRfq(prisma, rfqId)).resolves.toBeNull();
      await expect(projectIdOfOrder(prisma, orderId)).resolves.toBeNull();
    });

    // ── Detach scoping ───────────────────────────────────────────────────────
    // Both detach queries put projectId in the predicate, so proving ownership
    // of one project must never let its owner rewrite another project's links.

    it("detachRfq ignores an RFQ attached to a different project", async () => {
      resources = emptyResources();
      const scenario = await seedScenario(prisma, resources);
      const otherProjectId = await createProject(
        prisma,
        scenario.ownerId,
        "Other procurement project",
      );
      const rfqId = await createRfq(prisma, scenario, {
        projectId: otherProjectId,
      });

      await expect(
        repository.detachRfq(scenario.projectId, rfqId),
      ).resolves.toBe(false);
      await expect(projectIdOfRfq(prisma, rfqId)).resolves.toBe(otherProjectId);
    });

    it("detachOrder ignores an order attached to a different project", async () => {
      resources = emptyResources();
      const scenario = await seedScenario(prisma, resources);
      const otherProjectId = await createProject(
        prisma,
        scenario.ownerId,
        "Other procurement project",
      );
      const orderId = await createOrder(prisma, scenario, {
        projectId: otherProjectId,
      });

      await expect(
        repository.detachOrder(scenario.projectId, orderId),
      ).resolves.toBe(false);
      await expect(projectIdOfOrder(prisma, orderId)).resolves.toBe(
        otherProjectId,
      );
    });

    // ── findProcurement ──────────────────────────────────────────────────────

    it("reports procurement newest first with live counts and totals", async () => {
      resources = emptyResources();
      const scenario = await seedScenario(prisma, resources);

      const olderRfqId = await createRfq(prisma, scenario, {
        projectId: scenario.projectId,
        title: "Older RFQ",
        itemCount: 2,
        createdAt: OLDER,
        expiresAt: EXPIRED_AT,
      });
      const newerRfqId = await createRfq(prisma, scenario, {
        projectId: scenario.projectId,
        title: "Newer RFQ",
        itemCount: 1,
        createdAt: NEWER,
        expiresAt: EXPIRES_AT,
      });
      await createQuote(prisma, newerRfqId, scenario.sellerId);

      const olderOrderId = await createOrder(prisma, scenario, {
        projectId: scenario.projectId,
        createdAt: OLDER,
        totalAmount: "1234.5",
        status: "PENDING_CONFIRMATION",
      });
      const newerOrderId = await createOrder(prisma, scenario, {
        projectId: scenario.projectId,
        createdAt: NEWER,
        totalAmount: "20",
        status: "COMPLETED",
      });

      const procurement = await repository.findProcurement(scenario.projectId);

      expect(procurement.rfqs.map((rfq) => rfq.id)).toEqual([
        newerRfqId,
        olderRfqId,
      ]);
      expect(procurement.rfqs[0]).toMatchObject({
        title: "Newer RFQ",
        status: "OPEN",
        deliveryLocation: "Addis Ababa",
        itemCount: 1,
        quoteCount: 1,
      });
      // An OPEN row past its expiry is presented as EXPIRED without a write.
      expect(procurement.rfqs[1]).toMatchObject({
        title: "Older RFQ",
        status: "EXPIRED",
        itemCount: 2,
        quoteCount: 0,
      });
      await expect(
        prisma.requestForQuote.findUniqueOrThrow({
          where: { id: olderRfqId },
          select: { status: true },
        }),
      ).resolves.toEqual({ status: "OPEN" });

      expect(procurement.orders.map((order) => order.id)).toEqual([
        newerOrderId,
        olderOrderId,
      ]);
      // Decimal(14,2) must surface as a fixed two-decimal string.
      expect(procurement.orders[0]).toMatchObject({
        status: "COMPLETED",
        totalAmount: "20.00",
        itemCount: 1,
      });
      expect(procurement.orders[1]).toMatchObject({
        status: "PENDING_CONFIRMATION",
        totalAmount: "1234.50",
        itemCount: 1,
      });
    });

    // ── Awarded RFQ + its accepted quote's order ─────────────────────────────
    // Quote acceptance is how procurement really reaches a project: the awarded
    // order inherits the RFQ's projectId. Both links then pin the project, and
    // the awarded RFQ stops counting against completion while its order does
    // not — the whole point of counting OPEN RFQs and unsettled orders apart.

    it("keeps an awarded RFQ and its resulting order attached to the project", async () => {
      resources = emptyResources();
      const scenario = await seedScenario(prisma, resources);
      const rfqId = await createRfq(prisma, scenario, {
        projectId: scenario.projectId,
        title: "Awarded RFQ",
      });
      const quoteId = await createQuote(prisma, rfqId, scenario.sellerId);
      const orderId = await awardRfq(prisma, scenario, {
        rfqId,
        quoteId,
        projectId: scenario.projectId,
      });

      const procurement = await repository.findProcurement(scenario.projectId);
      expect(procurement.rfqs).toHaveLength(1);
      expect(procurement.rfqs[0]).toMatchObject({
        id: rfqId,
        status: "AWARDED",
        quoteCount: 1,
      });
      expect(procurement.orders).toHaveLength(1);
      expect(procurement.orders[0]).toMatchObject({
        id: orderId,
        itemCount: 1,
      });

      await expect(
        repository.countActiveProcurement(scenario.projectId),
      ).resolves.toEqual({ openRfqs: 0, activeOrders: 1 });

      await expect(
        repository.delete(scenario.projectId, scenario.ownerId),
      ).rejects.toBeInstanceOf(ProjectHasProcurementError);

      await expect(
        repository.detachRfq(scenario.projectId, rfqId),
      ).resolves.toBe(true);
      await expect(
        repository.detachOrder(scenario.projectId, orderId),
      ).resolves.toBe(true);
      await expect(
        repository.delete(scenario.projectId, scenario.ownerId),
      ).resolves.toBe(true);
    });

    it("returns empty lists for a project with no procurement", async () => {
      resources = emptyResources();
      const scenario = await seedScenario(prisma, resources);

      await expect(
        repository.findProcurement(scenario.projectId),
      ).resolves.toEqual({ rfqs: [], orders: [] });
    });

    // ── countActiveProcurement ───────────────────────────────────────────────

    it("counts only unexpired OPEN RFQs and unsettled orders", async () => {
      resources = emptyResources();
      const scenario = await seedScenario(prisma, resources);

      await createRfq(prisma, scenario, {
        projectId: scenario.projectId,
        title: "Soliciting quotes",
        expiresAt: EXPIRES_AT,
      });
      // OPEN but past expiry: domain-expired, so it must not block completion
      // forever just because nothing has read it since it lapsed.
      await createRfq(prisma, scenario, {
        projectId: scenario.projectId,
        title: "Lapsed",
        expiresAt: EXPIRED_AT,
      });
      await createRfq(prisma, scenario, {
        projectId: scenario.projectId,
        title: "Cancelled",
        expiresAt: EXPIRES_AT,
        status: "CANCELLED",
      });

      await createOrder(prisma, scenario, {
        projectId: scenario.projectId,
        status: "PROCESSING",
      });
      for (const status of SETTLED_ORDER_STATUSES) {
        await createOrder(prisma, scenario, {
          projectId: scenario.projectId,
          status,
        });
      }

      await expect(
        repository.countActiveProcurement(scenario.projectId),
      ).resolves.toEqual({ openRfqs: 1, activeOrders: 1 });
    });

    it("ignores procurement attached to another project", async () => {
      resources = emptyResources();
      const scenario = await seedScenario(prisma, resources);
      const otherProjectId = await createProject(
        prisma,
        scenario.ownerId,
        "Unrelated project",
      );
      await createRfq(prisma, scenario, {
        projectId: otherProjectId,
        expiresAt: EXPIRES_AT,
      });
      await createOrder(prisma, scenario, {
        projectId: otherProjectId,
        status: "PROCESSING",
      });
      // An unlinked order must be invisible to every project.
      await createOrder(prisma, scenario, { status: "PROCESSING" });

      await expect(
        repository.countActiveProcurement(scenario.projectId),
      ).resolves.toEqual({ openRfqs: 0, activeOrders: 0 });
      await expect(
        repository.findProcurement(scenario.projectId),
      ).resolves.toEqual({ rfqs: [], orders: [] });
      await expect(
        repository.countActiveProcurement(otherProjectId),
      ).resolves.toEqual({ openRfqs: 1, activeOrders: 1 });
    });
  },
);

// ── Seeding helpers ──────────────────────────────────────────────────────────

type RfqStatusValue = NonNullable<
  Prisma.RequestForQuoteUncheckedCreateInput["status"]
>;
type OrderStatusValue = NonNullable<Prisma.OrderUncheckedCreateInput["status"]>;

interface RfqOptions {
  projectId?: string;
  title?: string;
  itemCount?: number;
  status?: RfqStatusValue;
  expiresAt?: Date;
  createdAt?: Date;
}

interface OrderOptions {
  projectId?: string;
  status?: OrderStatusValue;
  totalAmount?: string;
  createdAt?: Date;
}

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
  resources: TestResources,
): Promise<ProcurementScenario> {
  const suffix = randomUUID();

  const owner = await prisma.user.create({
    data: {
      name: "Procurement Integration Professional",
      email: `procurement-owner-${suffix}@example.com`,
      passwordHash: "integration-test-password-hash",
      role: "PROFESSIONAL",
      emailVerified: true,
    },
  });
  resources.userIds.push(owner.id);

  const seller = await prisma.user.create({
    data: {
      name: "Procurement Integration Seller",
      email: `procurement-seller-${suffix}@example.com`,
      passwordHash: "integration-test-password-hash",
      role: "SELLER",
      emailVerified: true,
    },
  });
  resources.userIds.push(seller.id);

  const category = await prisma.category.create({
    data: { name: `Procurement Integration Category ${suffix}` },
  });
  resources.categoryIds.push(category.id);

  const product = await prisma.product.create({
    data: {
      sellerId: seller.id,
      categoryId: category.id,
      name: "Procurement Integration Product",
      description: "Product used by project procurement integration tests.",
      price: new Prisma.Decimal("99.00"),
      quantity: 10,
    },
  });

  const projectId = await createProject(
    prisma,
    owner.id,
    "Procurement Integration Project",
  );

  return {
    ownerId: owner.id,
    sellerId: seller.id,
    productId: product.id,
    projectId,
  };
}

async function createProject(
  prisma: PrismaClient,
  ownerId: string,
  title: string,
): Promise<string> {
  const project = await prisma.project.create({
    data: { ownerId, title },
  });

  return project.id;
}

async function createRfq(
  prisma: PrismaClient,
  scenario: ProcurementScenario,
  options: RfqOptions = {},
): Promise<string> {
  const itemCount = options.itemCount ?? 1;
  const expiresAt = options.expiresAt ?? EXPIRES_AT;
  // request_for_quotes carries CHECK ("expiresAt" > "createdAt"), so a
  // deliberately lapsed RFQ needs a createdAt older than its expiry rather than
  // the row default of now().
  const createdAt =
    options.createdAt ??
    (expiresAt.getTime() <= Date.now()
      ? new Date(expiresAt.getTime() - 24 * 60 * 60 * 1000)
      : undefined);

  const rfq = await prisma.requestForQuote.create({
    data: {
      customerId: scenario.ownerId,
      projectId: options.projectId ?? null,
      title: options.title ?? "Procurement Integration RFQ",
      deliveryLocation: "Addis Ababa",
      status: options.status ?? "OPEN",
      expiresAt,
      ...(createdAt ? { createdAt } : {}),
      items: {
        create: Array.from({ length: itemCount }, (_unused, index) => ({
          categoryName: "Cement",
          materialName: `Material ${index + 1}`,
          requestedQuantity: new Prisma.Decimal("10.000"),
          requestedUnit: "BAG" as const,
        })),
      },
    },
  });

  return rfq.id;
}

async function createQuote(
  prisma: PrismaClient,
  rfqId: string,
  sellerId: string,
): Promise<string> {
  // A quote must line up with its RFQ in two ways the database enforces
  // itself: every quote item points at an rfq_item of the same RFQ, and
  // totalAmount must equal the sum of the line totals (and be > 0).
  const rfqItem = await prisma.rfqItem.findFirstOrThrow({
    where: { rfqId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  const quote = await prisma.supplierQuote.create({
    data: {
      rfqId,
      sellerId,
      validUntil: EXPIRES_AT,
      leadTimeDays: 5,
      totalAmount: new Prisma.Decimal("500.00"),
      items: {
        create: [
          {
            rfqItemId: rfqItem.id,
            productName: "Quoted material",
            offeredQuantity: 10,
            unitPrice: new Prisma.Decimal("50.00"),
            lineTotal: new Prisma.Decimal("500.00"),
          },
        ],
      },
    },
  });

  return quote.id;
}

async function awardRfq(
  prisma: PrismaClient,
  scenario: ProcurementScenario,
  award: { rfqId: string; quoteId: string; projectId: string },
): Promise<string> {
  const orderId = await createOrder(prisma, scenario, {
    projectId: award.projectId,
  });

  // The awarded RFQ and its accepted quote must point at each other, and an
  // ACCEPTED quote must carry an orderId. Those consistency triggers are
  // DEFERRABLE INITIALLY DEFERRED, so the pair can only be assembled inside a
  // single transaction — exactly how the RFQ repository accepts a quote.
  await prisma.$transaction([
    prisma.supplierQuote.update({
      where: { id: award.quoteId },
      data: { status: "ACCEPTED", orderId },
    }),
    prisma.requestForQuote.update({
      where: { id: award.rfqId },
      data: { status: "AWARDED", awardedQuoteId: award.quoteId },
    }),
  ]);

  return orderId;
}

async function createOrder(
  prisma: PrismaClient,
  scenario: ProcurementScenario,
  options: OrderOptions = {},
): Promise<string> {
  const order = await prisma.order.create({
    data: {
      customerId: scenario.ownerId,
      projectId: options.projectId ?? null,
      status: options.status ?? "PENDING_CONFIRMATION",
      totalAmount: new Prisma.Decimal(options.totalAmount ?? "50.00"),
      ...(options.createdAt ? { createdAt: options.createdAt } : {}),
      items: {
        create: [
          {
            productId: scenario.productId,
            quantity: 2,
            unitPrice: new Prisma.Decimal("25.00"),
            subtotal: new Prisma.Decimal("50.00"),
            price: new Prisma.Decimal("25.00"),
          },
        ],
      },
    },
  });

  return order.id;
}

async function projectIdOfRfq(
  prisma: PrismaClient,
  rfqId: string,
): Promise<string | null> {
  const rfq = await prisma.requestForQuote.findUniqueOrThrow({
    where: { id: rfqId },
    select: { projectId: true },
  });

  return rfq.projectId;
}

async function projectIdOfOrder(
  prisma: PrismaClient,
  orderId: string,
): Promise<string | null> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { projectId: true },
  });

  return order.projectId;
}

async function cleanupResources(
  prisma: PrismaClient,
  resources: TestResources | undefined,
): Promise<void> {
  if (!resources || resources.userIds.length === 0) {
    return;
  }

  // Deletion order follows the RESTRICT edges: RFQs and orders pin the projects
  // they link to, order items pin products, and projects pin their owner, so
  // every dependent row goes before the row it points at. RFQs come first
  // because an ACCEPTED quote must keep its orderId, so deleting the order
  // while the quote still exists would trip the acceptance-state check.
  await prisma.$transaction(async (transaction) => {
    const rfqs = await transaction.requestForQuote.findMany({
      where: { customerId: { in: resources.userIds } },
      select: { id: true },
    });
    const rfqIds = rfqs.map((rfq) => rfq.id);

    if (rfqIds.length === 0) {
      return;
    }

    await transaction.requestForQuote.updateMany({
      where: { id: { in: rfqIds }, status: "AWARDED" },
      data: { status: "CANCELLED", awardedQuoteId: null },
    });
    // Deleting the quotes explicitly keeps the RFQ cascade from reaching
    // rfq_items while supplier_quote_items still point at them (RESTRICT).
    await transaction.supplierQuote.deleteMany({
      where: { rfqId: { in: rfqIds } },
    });
    await transaction.requestForQuote.deleteMany({
      where: { id: { in: rfqIds } },
    });
  });

  await prisma.order.deleteMany({
    where: { customerId: { in: resources.userIds } },
  });
  await prisma.product.deleteMany({
    where: { sellerId: { in: resources.userIds } },
  });
  await prisma.project.deleteMany({
    where: { ownerId: { in: resources.userIds } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: resources.userIds } },
  });
  await prisma.category.deleteMany({
    where: { id: { in: resources.categoryIds } },
  });
}
