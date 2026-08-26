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
}

export interface PublishedProjectResult {
  projects: ProjectEntity[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

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
   */
  searchPublished(query: PublishedProjectQuery): Promise<PublishedProjectResult>;
}
