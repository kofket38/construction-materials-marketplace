import type { PrismaClient } from "../src/prisma/generated/client.js";
import { Prisma } from "../src/prisma/generated/client.js";
import {
  ProjectHasProcurementError,
  ProjectReorderOwnershipError,
} from "../src/repositories/project.errors.js";
import { PrismaProjectRepository } from "../src/repositories/prisma-project.repository.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Fixed IDs ─────────────────────────────────────────────────────────────────
const ownerId    = "00000000-0000-4000-8000-000000000001";
const projectId  = "00000000-0000-4000-8000-000000000002";
const foreignId  = "00000000-0000-4000-8000-000000000003";

// ── Helpers ───────────────────────────────────────────────────────────────────
function prismaError(code: string): Error & { code: string } {
  return Object.assign(new Error(`Prisma error ${code}`), { code });
}

function baseProjectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: projectId,
    ownerId,
    title: "G+2 Residential Villa",
    description: "Full structural design and supervision.",
    projectType: "Residential",
    location: "Addis Ababa",
    budget: new Prisma.Decimal("250000"),
    startDate: new Date("2026-09-01T00:00:00.000Z"),
    endDate: null,
    images: ["https://example.com/site-photo.jpg"],
    displayOrder: 0,
    status: "DRAFT",
    publishedAt: null,
    createdAt: new Date("2026-08-26T10:00:00.000Z"),
    updatedAt: new Date("2026-08-26T10:00:00.000Z"),
    ...overrides,
  };
}

// ── Mock factory ──────────────────────────────────────────────────────────────
function createMock() {
  const mock = {
    project: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
    requestForQuote: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    order: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
  };

  // Support both the array form ([count, findMany]) used by searchPublished
  // and the interactive callback form used by reorder.
  mock.$transaction.mockImplementation(
    async (
      operation:
        | ((tx: typeof mock) => unknown)
        | Promise<unknown>[],
      _options?: unknown,
    ) => {
      if (Array.isArray(operation)) {
        return Promise.all(operation);
      }
      return operation(mock);
    },
  );

  return mock;
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("PrismaProjectRepository", () => {
  let mock: ReturnType<typeof createMock>;
  let repo: PrismaProjectRepository;

  beforeEach(() => {
    mock = createMock();
    repo = new PrismaProjectRepository(mock as unknown as PrismaClient);
  });

  // ── create ──────────────────────────────────────────────────────────────────

  it("creates a project and applies defaults for omitted fields", async () => {
    mock.project.create.mockResolvedValue(baseProjectRow());

    await repo.create({ ownerId, title: "  G+2 Residential Villa  " });

    expect(mock.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerId,
          title: "G+2 Residential Villa",
          description: null,
          projectType: null,
          location: null,
          budget: null,
          startDate: null,
          endDate: null,
          images: [],
          displayOrder: 0,
        }),
      }),
    );
  });

  it("converts the supplied budget into a Prisma Decimal", async () => {
    mock.project.create.mockResolvedValue(baseProjectRow());

    await repo.create({
      ownerId,
      title: "Villa",
      budget: "250000.50",
    });

    const call = mock.project.create.mock.calls[0]![0] as {
      data: { budget: Prisma.Decimal };
    };
    expect(call.data.budget.toFixed(2)).toBe("250000.50");
  });

  it("passes supplied project fields through to Prisma", async () => {
    mock.project.create.mockResolvedValue(baseProjectRow());

    const startDate = new Date("2026-09-01T00:00:00.000Z");
    const endDate = new Date("2027-03-01T00:00:00.000Z");
    await repo.create({
      ownerId,
      title: "Villa",
      description: "Full build.",
      projectType: "Residential",
      location: "Addis Ababa",
      startDate,
      endDate,
      images: ["https://example.com/a.jpg"],
      displayOrder: 2,
    });

    expect(mock.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: "Full build.",
          projectType: "Residential",
          location: "Addis Ababa",
          startDate,
          endDate,
          images: ["https://example.com/a.jpg"],
          displayOrder: 2,
        }),
      }),
    );
  });

  it("never sets status or publishedAt on create — projects start as DRAFT via the database default", async () => {
    mock.project.create.mockResolvedValue(baseProjectRow());

    await repo.create({ ownerId, title: "Villa" });

    const call = mock.project.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(call.data.status).toBeUndefined();
    expect(call.data.publishedAt).toBeUndefined();
  });

  // ── findById / findByOwnerId / countByOwner ────────────────────────────────

  it("finds a project by its own ID", async () => {
    mock.project.findUnique.mockResolvedValue(baseProjectRow());

    const project = await repo.findById(projectId);

    expect(project).not.toBeNull();
    expect(mock.project.findUnique).toHaveBeenCalledWith({
      where: { id: projectId },
      select: expect.objectContaining({ title: true, images: true }),
    });
  });

  it("returns null when the project ID does not exist", async () => {
    mock.project.findUnique.mockResolvedValue(null);

    expect(await repo.findById(projectId)).toBeNull();
  });

  it("scopes owner listing to the owner with deterministic ordering", async () => {
    mock.project.findMany.mockResolvedValue([]);

    await repo.findByOwnerId(ownerId);

    expect(mock.project.findMany).toHaveBeenCalledWith({
      where: { ownerId },
      select: expect.any(Object),
      orderBy: [
        { displayOrder: "asc" },
        { createdAt: "desc" },
        { id: "asc" },
      ],
    });
  });

  it("counts projects scoped to the owner", async () => {
    mock.project.count.mockResolvedValue(4);

    expect(await repo.countByOwner(ownerId)).toBe(4);
    expect(mock.project.count).toHaveBeenCalledWith({
      where: { ownerId },
    });
  });

  // ── update ──────────────────────────────────────────────────────────────────

  it("scopes updates to both the project ID and the owning user", async () => {
    mock.project.update.mockResolvedValue(baseProjectRow({ title: "Renamed" }));

    await repo.update(projectId, ownerId, { title: "Renamed" });

    expect(mock.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: projectId, ownerId },
        data: { title: "Renamed" },
      }),
    );
  });

  it("updates only the supplied fields", async () => {
    mock.project.update.mockResolvedValue(baseProjectRow());

    await repo.update(projectId, ownerId, {
      description: "Updated.",
      status: "PUBLISHED",
      publishedAt: new Date("2026-08-26T12:00:00.000Z"),
    });

    const call = mock.project.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(Object.keys(call.data).sort()).toEqual([
      "description",
      "publishedAt",
      "status",
    ]);
  });

  it("allows clearing optional fields to null via update", async () => {
    mock.project.update.mockResolvedValue(
      baseProjectRow({ budget: null, endDate: null, publishedAt: null }),
    );

    const result = await repo.update(projectId, ownerId, {
      budget: null,
      endDate: null,
      publishedAt: null,
    });

    expect(result!.budget).toBeNull();
    expect(result!.endDate).toBeNull();
    expect(result!.publishedAt).toBeNull();
  });

  it("returns null when updating a non-existent project (P2025)", async () => {
    mock.project.update.mockRejectedValue(prismaError("P2025"));

    expect(await repo.update(projectId, ownerId, { title: "X" })).toBeNull();
  });

  it("rethrows non-P2025 update errors", async () => {
    mock.project.update.mockRejectedValue(prismaError("P2002"));

    await expect(repo.update(projectId, ownerId, { title: "X" })).rejects.toMatchObject(
      { code: "P2002" },
    );
  });

  // ── delete ──────────────────────────────────────────────────────────────────

  it("deletes scoped to both the project ID and the owning user", async () => {
    mock.project.delete.mockResolvedValue(baseProjectRow());

    expect(await repo.delete(projectId, ownerId)).toBe(true);
    expect(mock.project.delete).toHaveBeenCalledWith({
      where: { id: projectId, ownerId },
    });
  });

  it("returns false when deleting a non-existent project (P2025)", async () => {
    mock.project.delete.mockRejectedValue(prismaError("P2025"));

    expect(await repo.delete(projectId, ownerId)).toBe(false);
  });

  it("translates a restricted procurement foreign key (P2003) into a domain error", async () => {
    mock.project.delete.mockRejectedValue(prismaError("P2003"));

    await expect(repo.delete(projectId, ownerId)).rejects.toBeInstanceOf(
      ProjectHasProcurementError,
    );
  });

  // ── reorder ─────────────────────────────────────────────────────────────────

  it("validates ownership inside the transaction before writing", async () => {
    const first = baseProjectRow({ id: projectId });
    const second = baseProjectRow({
      id: foreignId,
      title: "Second Project",
    });
    mock.project.findMany
      .mockResolvedValueOnce([{ id: projectId }, { id: foreignId }])
      .mockResolvedValueOnce([second, first]);

    await repo.reorder(ownerId, [second.id, first.id]);

    expect(mock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
    expect(mock.project.findMany).toHaveBeenCalledWith({
      where: { ownerId },
      select: { id: true },
    });
    expect(mock.project.update).toHaveBeenCalledTimes(2);
    expect(mock.project.update).toHaveBeenNthCalledWith(1, {
      where: { id: second.id },
      data: { displayOrder: 0 },
    });
    expect(mock.project.update).toHaveBeenNthCalledWith(2, {
      where: { id: first.id },
      data: { displayOrder: 1 },
    });
  });

  it("rejects foreign IDs without writing any rows", async () => {
    mock.project.findMany.mockResolvedValue([{ id: projectId }]);

    await expect(
      repo.reorder(ownerId, [projectId, foreignId]),
    ).rejects.toBeInstanceOf(ProjectReorderOwnershipError);

    expect(mock.project.update).not.toHaveBeenCalled();
  });

  it("rejects duplicate IDs without writing any rows", async () => {
    mock.project.findMany.mockResolvedValue([{ id: projectId }]);

    await expect(
      repo.reorder(ownerId, [projectId, projectId]),
    ).rejects.toBeInstanceOf(ProjectReorderOwnershipError);

    expect(mock.project.update).not.toHaveBeenCalled();
  });

  it("rejects partial lists that omit owned projects", async () => {
    mock.project.findMany.mockResolvedValue([
      { id: projectId },
      { id: foreignId },
    ]);

    await expect(repo.reorder(ownerId, [projectId])).rejects.toBeInstanceOf(
      ProjectReorderOwnershipError,
    );
    expect(mock.project.update).not.toHaveBeenCalled();
  });

  it("returns the reordered list in canonical owner order", async () => {
    const rowA = baseProjectRow({ id: projectId, displayOrder: 1 });
    const rowB = baseProjectRow({
      id: foreignId,
      title: "B Project",
      displayOrder: 0,
    });
    mock.project.findMany
      .mockResolvedValueOnce([{ id: projectId }, { id: foreignId }])
      .mockResolvedValueOnce([rowB, rowA]);

    const result = await repo.reorder(ownerId, [projectId, foreignId]);

    expect(result.map((p) => p.id)).toEqual([foreignId, projectId]);
  });

  // ── searchPublished ─────────────────────────────────────────────────────────

  it("enforces PUBLISHED at the database query level for both count and page queries", async () => {
    mock.project.count.mockResolvedValue(0);
    mock.project.findMany.mockResolvedValue([]);

    await repo.searchPublished({ page: 1, limit: 20 });

    expect(mock.$transaction).toHaveBeenCalledWith(
      [expect.any(Promise), expect.any(Promise)],
      expect.anything(),
    );
    expect(mock.project.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ status: "PUBLISHED" }),
    });
    expect(mock.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "PUBLISHED" }),
      }),
    );
  });

  it("passes search and projectType filters alongside the published guard", async () => {
    mock.project.count.mockResolvedValue(0);
    mock.project.findMany.mockResolvedValue([]);

    await repo.searchPublished({
      page: 2,
      limit: 10,
      search: "villa",
      projectType: "Residential",
    });

    const findManyCall = mock.project.findMany.mock.calls[0]![0] as {
      where: Record<string, unknown>;
      skip: number;
      take: number;
    };
    expect(findManyCall.where.status).toBe("PUBLISHED");
    expect(findManyCall.where.OR).toEqual([
      { title: { contains: "villa", mode: "insensitive" } },
      { description: { contains: "villa", mode: "insensitive" } },
      { location: { contains: "villa", mode: "insensitive" } },
    ]);
    expect(findManyCall.where.projectType).toEqual({
      contains: "Residential",
      mode: "insensitive",
    });
    expect(findManyCall.skip).toBe(10);
    expect(findManyCall.take).toBe(10);
  });

  it("orders published results by most recently published with an ID tie-breaker", async () => {
    mock.project.count.mockResolvedValue(0);
    mock.project.findMany.mockResolvedValue([]);

    await repo.searchPublished({ page: 1, limit: 10 });

    expect(mock.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      }),
    );
  });

  it("returns pagination metadata derived from the total count", async () => {
    mock.project.count.mockResolvedValue(21);
    mock.project.findMany.mockResolvedValue([]);

    const result = await repo.searchPublished({ page: 3, limit: 10 });

    expect(result.totalItems).toBe(21);
    expect(result.totalPages).toBe(3);
    expect(result.currentPage).toBe(3);
    expect(result.pageSize).toBe(10);
    expect(result.hasNextPage).toBe(false);
    expect(result.hasPreviousPage).toBe(true);
  });

  // ── Mapping ─────────────────────────────────────────────────────────────────

  it("maps rows to domain entities including dates and status", async () => {
    const publishedAt = new Date("2026-08-25T08:00:00.000Z");
    mock.project.findUnique.mockResolvedValue(
      baseProjectRow({
        status: "PUBLISHED",
        publishedAt,
        budget: Prisma.Decimal("150000.5"),
      }),
    );

    const project = await repo.findById(projectId);

    expect(project!.status).toBe("PUBLISHED");
    expect(project!.publishedAt).toEqual(publishedAt);
    expect(project!.budget).toBe("150000.50");
    expect(project!.startDate).toEqual(new Date("2026-09-01T00:00:00.000Z"));
    expect(project!.displayOrder).toBe(0);
    expect(project!.ownerId).toBe(ownerId);
  });

  it("maps a null budget to null on the entity", async () => {
    mock.project.findUnique.mockResolvedValue(baseProjectRow({ budget: null }));

    const project = await repo.findById(projectId);

    expect(project!.budget).toBeNull();
  });

  it("returns a defensive copy of stored image arrays", async () => {
    const row = baseProjectRow();
    mock.project.findUnique.mockResolvedValue(row);

    const project = await repo.findById(projectId);
    project!.images.push("https://example.com/mutated.jpg");

    expect(row.images).toEqual(["https://example.com/site-photo.jpg"]);
  });

  // ── findProcurement ─────────────────────────────────────────────────────────

  describe("findProcurement", () => {
    beforeEach(() => {
      mock.requestForQuote.findMany.mockResolvedValue([]);
      mock.order.findMany.mockResolvedValue([]);
    });

    it("reads both lists scoped to the project, newest first", async () => {
      await repo.findProcurement(projectId);

      expect(mock.requestForQuote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId },
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        }),
      );
      expect(mock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId },
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        }),
      );
    });

    it("maps summaries without pricing, shipping, or seller identities", async () => {
      mock.requestForQuote.findMany.mockResolvedValue([rfqRow()]);
      mock.order.findMany.mockResolvedValue([orderRow()]);

      const procurement = await repo.findProcurement(projectId);

      expect(procurement.rfqs).toEqual([
        {
          id: "00000000-0000-4000-8000-00000000000a",
          title: "Bulk cement",
          status: "OPEN",
          deliveryLocation: "Industrial Area",
          itemCount: 2,
          quoteCount: 3,
          expiresAt: futureDate,
          createdAt: new Date("2026-08-30T10:00:00.000Z"),
        },
      ]);
      expect(procurement.orders).toEqual([
        {
          id: "00000000-0000-4000-8000-00000000000b",
          status: "PENDING_CONFIRMATION",
          totalAmount: "1200.50",
          itemCount: 2,
          createdAt: new Date("2026-08-30T11:00:00.000Z"),
        },
      ]);
    });

    it("presents an OPEN request past its expiry as EXPIRED", async () => {
      mock.requestForQuote.findMany.mockResolvedValue([
        rfqRow({ expiresAt: new Date(Date.now() - 1_000) }),
      ]);

      const procurement = await repo.findProcurement(projectId);

      expect(procurement.rfqs[0]!.status).toBe("EXPIRED");
    });

    it("leaves a settled request status untouched", async () => {
      mock.requestForQuote.findMany.mockResolvedValue([
        rfqRow({
          status: "AWARDED",
          expiresAt: new Date(Date.now() - 1_000),
        }),
      ]);

      const procurement = await repo.findProcurement(projectId);

      expect(procurement.rfqs[0]!.status).toBe("AWARDED");
    });
  });

  // ── countActiveProcurement ──────────────────────────────────────────────────

  describe("countActiveProcurement", () => {
    beforeEach(() => {
      mock.requestForQuote.count.mockResolvedValue(0);
      mock.order.count.mockResolvedValue(0);
    });

    it("counts only OPEN requests that have not passed their expiry", async () => {
      await repo.countActiveProcurement(projectId);

      const where = (
        mock.requestForQuote.count.mock.calls[0]![0] as {
          where: {
            projectId: string;
            status: string;
            expiresAt: { gt: Date };
          };
        }
      ).where;
      expect(where.projectId).toBe(projectId);
      expect(where.status).toBe("OPEN");
      expect(where.expiresAt.gt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it("counts orders that have not reached a settled status", async () => {
      await repo.countActiveProcurement(projectId);

      expect(mock.order.count).toHaveBeenCalledWith({
        where: {
          projectId,
          status: {
            notIn: [
              "COMPLETED",
              "CANCELLED",
              "REJECTED",
              "PAYMENT_REJECTED",
            ],
          },
        },
      });
    });

    it("returns both counts", async () => {
      mock.requestForQuote.count.mockResolvedValue(2);
      mock.order.count.mockResolvedValue(1);

      await expect(repo.countActiveProcurement(projectId)).resolves.toEqual({
        openRfqs: 2,
        activeOrders: 1,
      });
    });
  });

  // ── detachRfq / detachOrder ─────────────────────────────────────────────────

  describe("detachRfq", () => {
    const rfqId = "00000000-0000-4000-8000-00000000000a";

    it("clears the link scoped to both identifiers", async () => {
      mock.requestForQuote.updateMany.mockResolvedValue({ count: 1 });

      await expect(repo.detachRfq(projectId, rfqId)).resolves.toBe(true);

      // Both keys in the predicate: an RFQ attached to another project cannot
      // be touched by ID alone.
      expect(mock.requestForQuote.updateMany).toHaveBeenCalledWith({
        where: { id: rfqId, projectId },
        data: { projectId: null },
      });
    });

    it("reports false when no attached request matched", async () => {
      mock.requestForQuote.updateMany.mockResolvedValue({ count: 0 });

      await expect(repo.detachRfq(projectId, rfqId)).resolves.toBe(false);
    });
  });

  describe("detachOrder", () => {
    const orderId = "00000000-0000-4000-8000-00000000000b";

    it("clears the link scoped to both identifiers", async () => {
      mock.order.updateMany.mockResolvedValue({ count: 1 });

      await expect(repo.detachOrder(projectId, orderId)).resolves.toBe(true);
      expect(mock.order.updateMany).toHaveBeenCalledWith({
        where: { id: orderId, projectId },
        data: { projectId: null },
      });
    });

    it("reports false when no attached order matched", async () => {
      mock.order.updateMany.mockResolvedValue({ count: 0 });

      await expect(repo.detachOrder(projectId, orderId)).resolves.toBe(false);
    });
  });
});

// ── Procurement row factories ─────────────────────────────────────────────────

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

function rfqRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-00000000000a",
    title: "Bulk cement",
    status: "OPEN",
    deliveryLocation: "Industrial Area",
    expiresAt: futureDate,
    createdAt: new Date("2026-08-30T10:00:00.000Z"),
    _count: { items: 2, quotes: 3 },
    ...overrides,
  };
}

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-00000000000b",
    status: "PENDING_CONFIRMATION",
    totalAmount: new Prisma.Decimal("1200.5"),
    createdAt: new Date("2026-08-30T11:00:00.000Z"),
    _count: { items: 2 },
    ...overrides,
  };
}
