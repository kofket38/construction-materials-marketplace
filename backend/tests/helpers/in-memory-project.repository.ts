import { randomUUID } from "node:crypto";
import {
  ProjectHasProcurementError,
  ProjectReorderOwnershipError,
} from "../../src/repositories/project.errors.js";
import { SETTLED_ORDER_STATUSES } from "../../src/repositories/project.repository.js";
import type {
  CreateProjectInput,
  ProjectEntity,
  ProjectOrderSummary,
  ProjectProcurementLoad,
  ProjectProcurementSummary,
  ProjectRfqSummary,
  ProjectStatus,
  PublicProjectDetail,
  PublicProjectItem,
  PublishedProjectQuery,
  PublishedProjectResult,
  UpdateProjectInput,
} from "../../src/repositories/project.repository.js";
import type { ProjectRepository } from "../../src/repositories/project.repository.js";

/**
 * The in-memory project repository owns no procurement data — RFQs and orders
 * live in their own in-memory repositories. Tests wire those in through
 * useProcurementSources() so a project's procurement view reflects whatever the
 * RFQ/order repositories actually recorded, exactly like the PostgreSQL joins.
 */
export interface ProcurementRfqSource {
  listProjectRfqs(projectId: string): ProjectRfqSummary[];
  /** Clears the link on an RFQ currently attached to this project. */
  detachProjectRfq(projectId: string, rfqId: string): boolean;
}

export interface ProcurementOrderSource {
  listProjectOrders(projectId: string): ProjectOrderSummary[];
  /** Clears the link on an order currently attached to this project. */
  detachProjectOrder(projectId: string, orderId: string): boolean;
}

function containsInsensitive(
  haystack: string | null,
  needle: string,
): boolean {
  return (
    haystack !== null && haystack.toLowerCase().includes(needle.toLowerCase())
  );
}

/** Shallow clone with a fresh images array so callers can never mutate stored
 * state through shared references. */
function cloneProject(project: ProjectEntity): ProjectEntity {
  return { ...project, images: [...project.images] };
}

/** Convert an owned ProjectEntity to the public card shape (owner = null in
 * the test context because the in-memory repo has no professional profile
 * data). This is the correct behaviour for the test layer. */
function toPublicItem(project: ProjectEntity): PublicProjectItem {
  return {
    id: project.id,
    title: project.title,
    description: project.description,
    projectType: project.projectType,
    location: project.location,
    budget: project.budget,
    startDate: project.startDate,
    endDate: project.endDate,
    images: [...project.images],
    status: project.status,
    publishedAt: project.publishedAt,
    owner: null,
  };
}

export class InMemoryProjectRepository implements ProjectRepository {
  // Keyed by projectId
  private readonly projects = new Map<string, ProjectEntity>();
  // Secondary index: ownerId → projectIds
  private readonly byOwner = new Map<string, string[]>();
  private rfqSource: ProcurementRfqSource | null = null;
  private orderSources: readonly ProcurementOrderSource[] = [];

  // ── Seed helpers ────────────────────────────────────────────────────────────

  /**
   * Attach the RFQ and/or order repositories used by the same app instance so
   * findProcurement()/countActiveProcurement() can see their data. Unwired
   * sources simply contribute nothing, so suites that never link procurement
   * behave as before.
   *
   * More than one order source may be wired: direct orders live in the order
   * repository while quote-acceptance orders are written by the RFQ
   * repository, and PostgreSQL sees both through the same orders.projectId
   * column.
   */
  useProcurementSources(sources: {
    rfqs?: ProcurementRfqSource;
    orders?: ProcurementOrderSource | readonly ProcurementOrderSource[];
  }): void {
    this.rfqSource = sources.rfqs ?? null;
    this.orderSources =
      sources.orders === undefined
        ? []
        : Array.isArray(sources.orders)
          ? [...sources.orders]
          : [sources.orders as ProcurementOrderSource];
  }

  /**
   * Directly insert a complete project, bypassing business rules.
   * Useful in beforeEach to set up preconditions.
   */
  addProject(
    ownerId: string,
    overrides: Partial<Omit<ProjectEntity, "ownerId">> = {},
  ): ProjectEntity {
    const now = new Date();
    const project: ProjectEntity = {
      id: overrides.id ?? randomUUID(),
      ownerId,
      title: overrides.title ?? "Test Project",
      description: overrides.description ?? null,
      projectType: overrides.projectType ?? null,
      location: overrides.location ?? null,
      budget: overrides.budget ?? null,
      startDate: overrides.startDate ?? null,
      endDate: overrides.endDate ?? null,
      images: overrides.images ? [...overrides.images] : [],
      displayOrder: overrides.displayOrder ?? 0,
      status: overrides.status ?? "DRAFT",
      publishedAt: overrides.publishedAt ?? null,
      createdAt: overrides.createdAt ?? now,
      updatedAt: overrides.updatedAt ?? now,
    };
    this.projects.set(project.id, project);
    const owned = this.byOwner.get(ownerId) ?? [];
    owned.push(project.id);
    this.byOwner.set(ownerId, owned);
    return cloneProject(project);
  }

  // ── Interface implementation ────────────────────────────────────────────────

  async create(input: CreateProjectInput): Promise<ProjectEntity> {
    // FK enforcement (owner must exist) belongs to the database; users are
    // managed outside this repository, mirroring the other in-memory repos.
    const now = new Date();
    const project: ProjectEntity = {
      id: randomUUID(),
      ownerId: input.ownerId,
      title: input.title.trim(),
      description: input.description ?? null,
      projectType: input.projectType ?? null,
      location: input.location ?? null,
      budget: input.budget ?? null,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      images: input.images ? [...input.images] : [],
      displayOrder: input.displayOrder ?? 0,
      status: "DRAFT",
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    this.projects.set(project.id, project);
    const owned = this.byOwner.get(input.ownerId) ?? [];
    owned.push(project.id);
    this.byOwner.set(input.ownerId, owned);

    return cloneProject(project);
  }

  async findById(projectId: string): Promise<ProjectEntity | null> {
    const project = this.projects.get(projectId);
    return project ? cloneProject(project) : null;
  }

  async findByOwnerId(ownerId: string): Promise<ProjectEntity[]> {
    const owned = this.byOwner.get(ownerId) ?? [];
    const projects = owned
      .map((id) => this.projects.get(id))
      .filter((p): p is ProjectEntity => p !== undefined);

    // Mirror projectOrderBy() in the Prisma repository exactly:
    // displayOrder ascending, then newest first, then project ID.
    const byId = (a: ProjectEntity, b: ProjectEntity): number =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

    projects.sort(
      (a, b) =>
        a.displayOrder - b.displayOrder ||
        b.createdAt.getTime() - a.createdAt.getTime() ||
        byId(a, b),
    );

    return projects.map(cloneProject);
  }

  async countByOwner(ownerId: string): Promise<number> {
    return (this.byOwner.get(ownerId) ?? []).length;
  }

  async update(
    projectId: string,
    ownerId: string,
    input: UpdateProjectInput,
  ): Promise<ProjectEntity | null> {
    // Scoped by owner so another owner's project is reported as missing.
    const project = this.projects.get(projectId);
    if (!project || project.ownerId !== ownerId) return null;

    if (input.title !== undefined) project.title = input.title.trim();
    if (input.description !== undefined)
      project.description = input.description;
    if (input.projectType !== undefined)
      project.projectType = input.projectType;
    if (input.location !== undefined) project.location = input.location;
    if (input.budget !== undefined) project.budget = input.budget;
    if (input.startDate !== undefined) project.startDate = input.startDate;
    if (input.endDate !== undefined) project.endDate = input.endDate;
    if (input.images !== undefined) project.images = [...input.images];
    if (input.displayOrder !== undefined)
      project.displayOrder = input.displayOrder;
    if (input.status !== undefined)
      project.status = input.status as ProjectStatus;
    if (input.publishedAt !== undefined)
      project.publishedAt = input.publishedAt;

    project.updatedAt = new Date();
    return cloneProject(project);
  }

  async delete(projectId: string, ownerId: string): Promise<boolean> {
    const project = this.projects.get(projectId);
    if (!project || project.ownerId !== ownerId) return false;

    // Mirrors the ON DELETE RESTRICT procurement foreign keys: PostgreSQL
    // refuses the delete while an RFQ or order still references the project.
    const { rfqs, orders } = await this.findProcurement(projectId);
    if (rfqs.length > 0 || orders.length > 0) {
      throw new ProjectHasProcurementError();
    }

    this.projects.delete(projectId);
    const owned = this.byOwner.get(ownerId)!;
    owned.splice(owned.indexOf(projectId), 1);
    if (owned.length === 0) this.byOwner.delete(ownerId);
    return true;
  }

  async reorder(
    ownerId: string,
    orderedIds: string[],
  ): Promise<ProjectEntity[]> {
    // Validate the full list BEFORE any mutation so a rejection leaves the
    // existing ordering completely untouched — mirroring the atomic
    // transaction in the Prisma implementation.
    const owned = this.findByOwnerIdSync(ownerId);

    const ownedIds = new Set(owned.map((p) => p.id));
    const suppliedIds = new Set(orderedIds);

    if (
      orderedIds.length !== owned.length ||
      suppliedIds.size !== orderedIds.length ||
      !orderedIds.every((id) => ownedIds.has(id))
    ) {
      throw new ProjectReorderOwnershipError();
    }

    const now = new Date();
    for (let index = 0; index < orderedIds.length; index += 1) {
      const id = orderedIds[index]!;
      const project = this.projects.get(id)!;
      project.displayOrder = index;
      project.updatedAt = now;
    }

    return this.findByOwnerId(ownerId);
  }

  async searchPublished(
    query: PublishedProjectQuery,
  ): Promise<PublishedProjectResult> {
    // Security-critical: mirror the Prisma implementation by filtering on
    // status = PUBLISHED before any other logic runs.
    let matches = [...this.projects.values()].filter(
      (project) => project.status === "PUBLISHED",
    );

    if (query.ownerId !== undefined) {
      matches = matches.filter((p) => p.ownerId === query.ownerId);
    }
    if (query.projectType !== undefined) {
      matches = matches.filter((p) =>
        containsInsensitive(p.projectType, query.projectType!),
      );
    }
    if (query.location !== undefined) {
      matches = matches.filter((p) =>
        containsInsensitive(p.location, query.location!),
      );
    }
    if (query.search !== undefined) {
      const search = query.search;
      matches = matches.filter(
        (p) =>
          containsInsensitive(p.title, search) ||
          containsInsensitive(p.description, search) ||
          containsInsensitive(p.location, search),
      );
    }

    const byId = (a: ProjectEntity, b: ProjectEntity): number =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

    // Mirror publishedProjectOrderBy() and PostgreSQL DESC NULLS FIRST
    // semantics exactly: most recently published first, ID tie-breaker.
    matches.sort((a, b) => {
      if (a.publishedAt === null && b.publishedAt === null) return byId(a, b);
      if (a.publishedAt === null) return -1;
      if (b.publishedAt === null) return 1;
      return b.publishedAt.getTime() - a.publishedAt.getTime() || byId(a, b);
    });

    const totalItems = matches.length;
    const totalPages = Math.ceil(totalItems / query.limit);
    const page = matches.slice(
      (query.page - 1) * query.limit,
      query.page * query.limit,
    );

    return {
      projects: page.map(toPublicItem),
      totalItems,
      totalPages,
      currentPage: query.page,
      pageSize: query.limit,
      hasNextPage: query.page < totalPages,
      hasPreviousPage: query.page > 1,
    };
  }

  async findPublicById(projectId: string): Promise<PublicProjectDetail | null> {
    const project = this.projects.get(projectId);
    if (!project || project.status !== "PUBLISHED") return null;
    return {
      id: project.id,
      title: project.title,
      description: project.description,
      projectType: project.projectType,
      location: project.location,
      budget: project.budget,
      startDate: project.startDate,
      endDate: project.endDate,
      images: [...project.images],
      status: project.status,
      publishedAt: project.publishedAt,
      owner: null,
    };
  }

  async findProcurement(
    projectId: string,
  ): Promise<ProjectProcurementSummary> {
    const rfqs = this.rfqSource?.listProjectRfqs(projectId) ?? [];
    const orders = this.orderSources.flatMap((source) =>
      source.listProjectOrders(projectId),
    );

    // Mirror the Prisma ordering: newest first, ID tie-breaker.
    return {
      rfqs: [...rfqs].sort(newestFirst),
      orders: [...orders].sort(newestFirst),
    };
  }

  async countActiveProcurement(
    projectId: string,
  ): Promise<ProjectProcurementLoad> {
    const { rfqs, orders } = await this.findProcurement(projectId);

    return {
      // findProcurement already reports an OPEN-but-expired RFQ as EXPIRED,
      // matching the Prisma repository's expiresAt filter.
      openRfqs: rfqs.filter((rfq) => rfq.status === "OPEN").length,
      activeOrders: orders.filter(
        (order) =>
          !SETTLED_ORDER_STATUSES.some((status) => status === order.status),
      ).length,
    };
  }

  async detachRfq(projectId: string, rfqId: string): Promise<boolean> {
    // Both identifiers are required, mirroring the Prisma updateMany
    // predicate: an RFQ attached elsewhere (or to nothing) matches nothing.
    return this.rfqSource?.detachProjectRfq(projectId, rfqId) ?? false;
  }

  async detachOrder(projectId: string, orderId: string): Promise<boolean> {
    // Every wired source is consulted: a direct order lives in the order
    // repository while a quote-acceptance order lives in the RFQ repository,
    // and PostgreSQL clears either one through the same orders.projectId
    // column.
    for (const source of this.orderSources) {
      if (source.detachProjectOrder(projectId, orderId)) {
        return true;
      }
    }

    return false;
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  private findByOwnerIdSync(ownerId: string): ProjectEntity[] {
    const owned = this.byOwner.get(ownerId) ?? [];
    return owned
      .map((id) => this.projects.get(id))
      .filter((p): p is ProjectEntity => p !== undefined);
  }
}

function newestFirst(
  left: { id: string; createdAt: Date },
  right: { id: string; createdAt: Date },
): number {
  return (
    right.createdAt.getTime() - left.createdAt.getTime() ||
    (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
  );
}
