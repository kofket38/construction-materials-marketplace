import type { OrderStatus } from "./order.repository.js";
import type { RfqStatus } from "./rfq.repository.js";

// ── Status type mirrors the Prisma enum ───────────────────────────────────────
export type ProjectStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

// ── Entity ────────────────────────────────────────────────────────────────────

export interface ProjectEntity {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  projectType: string | null;
  location: string | null;
  /** Fixed two-decimal string, or null when the project has no budget. */
  budget: string | null;
  startDate: Date | null;
  endDate: Date | null;
  images: string[];
  displayOrder: number;
  status: ProjectStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface CreateProjectInput {
  ownerId: string;
  title: string;
  description?: string | null;
  projectType?: string | null;
  location?: string | null;
  budget?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  images?: string[];
  displayOrder?: number;
}

/**
 * Partial update of a project's scalar fields. Includes the raw lifecycle
 * columns (status/publishedAt) so the service layer can orchestrate status
 * transitions — no transition rules live at this layer.
 */
export interface UpdateProjectInput {
  title?: string;
  description?: string | null;
  projectType?: string | null;
  location?: string | null;
  budget?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  images?: string[];
  displayOrder?: number;
  status?: ProjectStatus;
  publishedAt?: Date | null;
}

// ── Published search (public discovery) ───────────────────────────────────────

export interface PublishedProjectQuery {
  page: number;
  limit: number;
  search?: string;
  projectType?: string;
  /** Filter by project location (case-insensitive substring). */
  location?: string;
  /**
   * Filter by owner User.id. Used by the professional profile page to show
   * only published projects belonging to a specific professional.
   * This is deliberately User.id (not ProfessionalProfile.id) because the
   * Project model's ownerId references the users table directly.
   */
  ownerId?: string;
}

// ── Public owner information (safe subset for unauthenticated consumers) ──────

/**
 * Minimal safe professional info attached to a published project card.
 * Only returned when the owner has a PUBLIC professional profile.
 * Fields that must NEVER appear: phone, email, userId, and any User fields.
 */
export interface PublicOwnerInfo {
  /** ProfessionalProfile.id — the correct public identifier for /professionals/:profileId */
  profileId: string;
  displayName: string;
  headline: string | null;
  profession: string | null;
  avatarUrl: string | null;
  city: string | null;
  country: string | null;
}

/** Richer safe owner info for the public project detail page. */
export interface PublicOwnerDetailInfo extends PublicOwnerInfo {
  yearsExperience: number | null;
  company: string | null;
  region: string | null;
  website: string | null;
  linkedinUrl: string | null;
  specialties: string[];
}

/** A published project card enriched with safe owner info. */
export interface PublicProjectItem extends Omit<ProjectEntity,
  | "ownerId"
  | "displayOrder"
  | "updatedAt"
  | "createdAt"
> {
  owner: PublicOwnerInfo | null;
}

/** Full published project detail enriched with safe detailed owner info. */
export interface PublicProjectDetail extends Omit<ProjectEntity,
  | "ownerId"
  | "displayOrder"
  | "updatedAt"
  | "createdAt"
> {
  owner: PublicOwnerDetailInfo | null;
}

export interface PublishedProjectResult {
  projects: PublicProjectItem[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ── Linked procurement (owner-private) ────────────────────────────────────────

/**
 * Summary of an RFQ attached to a project. Deliberately a summary, not the
 * full RequestForQuoteEntity: this view only needs enough to render a list and
 * link through to the existing RFQ detail page, which already applies its own
 * authorization.
 */
export interface ProjectRfqSummary {
  id: string;
  title: string;
  status: RfqStatus;
  deliveryLocation: string;
  itemCount: number;
  quoteCount: number;
  expiresAt: Date;
  createdAt: Date;
}

/** Summary of an order attached to a project. */
export interface ProjectOrderSummary {
  id: string;
  status: OrderStatus;
  /** Fixed two-decimal string, matching OrderEntity.totalAmount. */
  totalAmount: string;
  itemCount: number;
  createdAt: Date;
}

/**
 * Everything a project owner sees about procurement linked to one of their
 * projects. This shape is owner-private and never merged into the public
 * project detail payload.
 */
export interface ProjectProcurementSummary {
  rfqs: ProjectRfqSummary[];
  orders: ProjectOrderSummary[];
}

/**
 * Counts of unfinished procurement attached to a project. Used by the
 * lifecycle guard that blocks completion while obligations remain.
 */
export interface ProjectProcurementLoad {
  /** RFQs still soliciting quotes (RfqStatus OPEN). */
  openRfqs: number;
  /** Orders that have not reached a settled status. */
  activeOrders: number;
}

/**
 * Order statuses that count as settled for the project lifecycle guard. Both
 * the Prisma and in-memory project repositories read this list, so the guard
 * cannot drift between them.
 *
 * COMPLETED and CANCELLED are the marketplace's terminal states —
 * OrderService.allowedAdminTransitions returns no onward transitions for
 * exactly those two. REJECTED and PAYMENT_REJECTED are included as well: they
 * only ever transition to CANCELLED, and a buyer cannot cancel them
 * themselves, so treating them as active would let a dead order block project
 * completion until an administrator intervened.
 */
export const SETTLED_ORDER_STATUSES = [
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
  "PAYMENT_REJECTED",
] as const satisfies readonly OrderStatus[];

// ── Repository interface ──────────────────────────────────────────────────────

export interface ProjectRepository {
  /**
   * Create a new project owned by the supplied user. New projects always
   * start in DRAFT status with publishedAt unset; status transitions are the
   * service layer's responsibility.
   */
  create(input: CreateProjectInput): Promise<ProjectEntity>;

  /**
   * Find a project by its own primary key. Returns null when it does not
   * exist.
   */
  findById(projectId: string): Promise<ProjectEntity | null>;

  /**
   * List every project owned by a user in display order:
   * displayOrder ascending, then newest first, with the project ID as the
   * deterministic tie-breaker.
   */
  findByOwnerId(ownerId: string): Promise<ProjectEntity[]>;

  /**
   * Count the projects that belong to a user.
   */
  countByOwner(ownerId: string): Promise<number>;

  /**
   * Partially update a project. The update is scoped to BOTH the project ID
   * and the owning user ID, so another owner's project is reported as missing
   * rather than being modified. Returns null when no matching project exists.
   */
  update(
    projectId: string,
    ownerId: string,
    input: UpdateProjectInput,
  ): Promise<ProjectEntity | null>;

  /**
   * Delete a project. The delete is scoped to BOTH the project ID and the
   * owning user ID, so another owner's project cannot be deleted through
   * this method. Returns true when deleted, false when not found.
   */
  delete(projectId: string, ownerId: string): Promise<boolean>;

  /**
   * Atomically reassign displayOrder values for an owner's projects according
   * to the supplied ID order (index 0 first). The list must exactly match the
   * owner's projects — unknown IDs, IDs belonging to another owner, and
   * duplicates are rejected without modifying any row.
   * Throws ProjectReorderOwnershipError otherwise.
   */
  reorder(ownerId: string, orderedIds: string[]): Promise<ProjectEntity[]>;

  /**
   * Search PUBLISHED projects for public discovery. The PUBLISHED filter is
   * applied at the database-query level so DRAFT, IN_PROGRESS, COMPLETED,
   * and CANCELLED projects can never leak through any filter combination.
   * Results are ordered by most recently published first, with the project
   * ID as the deterministic tie-breaker.
   * The response shape is the public card shape (no ownerId, no displayOrder,
   * includes safe owner info when the owner has a PUBLIC professional profile).
   */
  searchPublished(query: PublishedProjectQuery): Promise<PublishedProjectResult>;

  /**
   * Fetch a single PUBLISHED project by ID with enriched safe owner info for
   * the public detail page. Returns null when not found or not published.
   * The caller (service) is responsible for the 404 error.
   */
  findPublicById(projectId: string): Promise<PublicProjectDetail | null>;

  /**
   * List the RFQs and orders attached to a project, newest first. The query is
   * keyed on projectId only — the caller (service) is responsible for proving
   * the requester owns the project before calling this.
   */
  findProcurement(projectId: string): Promise<ProjectProcurementSummary>;

  /**
   * Count the project's unfinished procurement: RFQs still OPEN and orders
   * that have not reached a terminal status. Used by the lifecycle guard.
   */
  countActiveProcurement(projectId: string): Promise<ProjectProcurementLoad>;

  /**
   * Clear the project link on one RFQ. Scoped to rows currently attached to
   * this project, so a foreign or already-detached RFQ changes nothing and
   * reports false — the caller (service) turns that into a 404.
   *
   * Detaching is deliberately independent of the RFQ's own lifecycle: the RFQ
   * update endpoint only accepts OPEN, quote-free requests, so without this
   * the owner could never clear the link left by an awarded or quoted request
   * and could never delete the project.
   */
  detachRfq(projectId: string, rfqId: string): Promise<boolean>;

  /**
   * Clear the project link on one order. Orders have no update endpoint at
   * all, so this is the only way an owner can release a project their order
   * history points at.
   */
  detachOrder(projectId: string, orderId: string): Promise<boolean>;
}
