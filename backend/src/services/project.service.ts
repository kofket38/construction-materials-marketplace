import type { AuthenticatedUser } from "../types/auth.js";
import type { ProcurementProjectSummary } from "./procurement-project.port.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../utils/api-error.js";
import {
  ProjectHasProcurementError,
  ProjectReorderOwnershipError,
} from "../repositories/project.errors.js";
import type {
  CreateProjectInput,
  ProjectEntity,
  ProjectProcurementSummary,
  ProjectRepository,
  ProjectStatus,
  PublicProjectDetail,
  PublishedProjectResult,
  UpdateProjectInput,
} from "../repositories/project.repository.js";
import type {
  ChangeProjectStatusBody,
  CreateProjectBody,
  ListPublishedProjectsQueryParams,
  ReorderProjectsBody,
  UpdateProjectBody,
} from "../validators/project.validators.js";

/**
 * Allowed lifecycle transitions. Anything not listed here is rejected with a
 * 400 before the repository is touched. Terminal states (COMPLETED,
 * CANCELLED) have no outgoing transitions.
 */
const VALID_STATUS_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  DRAFT: ["PUBLISHED"],
  PUBLISHED: ["DRAFT", "IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export class ProjectService {
  constructor(private readonly projects: ProjectRepository) {}

  // ── Owner CRUD ────────────────────────────────────────────────────────────

  createProject(
    actor: AuthenticatedUser,
    input: CreateProjectBody,
  ): Promise<ProjectEntity> {
    this.requireProfessional(actor);

    const data: CreateProjectInput = {
      ownerId: actor.userId,
      title: input.title,
      description: input.description ?? null,
      projectType: input.projectType ?? null,
      location: input.location ?? null,
      budget: input.budget ?? null,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      ...(input.images !== undefined ? { images: input.images } : {}),
      ...(input.displayOrder !== undefined
        ? { displayOrder: input.displayOrder }
        : {}),
    };

    return this.projects.create(data);
  }

  /**
   * Lists every project owned by the authenticated professional in display
   * order, regardless of status.
   */
  async getMyProjects(actor: AuthenticatedUser): Promise<ProjectEntity[]> {
    this.requireProfessional(actor);

    return this.projects.findByOwnerId(actor.userId);
  }

  /**
   * Returns one of the authenticated user's own projects. Foreign and
   * non-existent project IDs are indistinguishable (404) so ownership
   * information can never leak.
   */
  async getMyProject(
    actor: AuthenticatedUser,
    projectId: string,
  ): Promise<ProjectEntity> {
    const project = await this.projects.findById(projectId);

    if (!project || project.ownerId !== actor.userId) {
      throw new NotFoundError("Project not found.");
    }

    return project;
  }

  /**
   * Public detail access. The owner may read their project in any status;
   * everyone else (authenticated or not) may only see PUBLISHED projects.
   * Non-published projects are reported as missing rather than forbidden so
   * draft/hidden state and existence are never exposed to outsiders.
   */
  async getProject(
    actor: AuthenticatedUser | null,
    projectId: string,
  ): Promise<ProjectEntity> {
    const project = await this.projects.findById(projectId);

    if (!project) {
      throw new NotFoundError("Project not found.");
    }

    if (actor !== null && actor.userId === project.ownerId) {
      return project;
    }

    if (project.status !== "PUBLISHED") {
      throw new NotFoundError("Project not found.");
    }

    return project;
  }

  async updateProject(
    actor: AuthenticatedUser,
    projectId: string,
    input: UpdateProjectBody,
  ): Promise<ProjectEntity> {
    this.requireProfessional(actor);

    // Fetch first so we can enforce the terminal-status read-only rule and
    // ownership in a single consistent pass. The lookup is owner-scoped so a
    // foreign project ID is indistinguishable from a missing one (404).
    const existing = await this.projects.findById(projectId);

    if (!existing || existing.ownerId !== actor.userId) {
      throw new NotFoundError("Project not found.");
    }

    // COMPLETED and CANCELLED projects are terminal and read-only. Field
    // edits are rejected with a 400 so the caller receives a clear reason
    // rather than a silent no-op.
    if (existing.status === "COMPLETED" || existing.status === "CANCELLED") {
      throw new BadRequestError(
        `A ${existing.status.toLowerCase()} project cannot be edited.`,
      );
    }

    // Scoped by owner at the repository level; null means the project either
    // does not exist or belongs to someone else, which must be reported as
    // missing rather than forbidden.
    const updated = await this.projects.update(
      projectId,
      actor.userId,
      this.toUpdateInput(input),
    );

    if (!updated) {
      throw new NotFoundError("Project not found.");
    }

    return updated;
  }

  async deleteProject(
    actor: AuthenticatedUser,
    projectId: string,
  ): Promise<void> {
    this.requireProfessional(actor);

    let deleted: boolean;

    try {
      deleted = await this.projects.delete(projectId, actor.userId);
    } catch (error) {
      // The procurement links are ON DELETE RESTRICT: an RFQ or order must
      // never lose the project it was raised for. Detaching or settling the
      // procurement is the owner's call, so this is reported rather than
      // resolved automatically.
      if (error instanceof ProjectHasProcurementError) {
        throw new ConflictError(
          "This project has requests for quote or orders attached to it. Detach them before deleting the project.",
        );
      }

      throw error;
    }

    if (!deleted) {
      throw new NotFoundError("Project not found.");
    }
  }

  /**
   * Applies a full reorder for the authenticated user's projects. Invalid
   * lists (unknown IDs, foreign IDs, duplicates, incomplete coverage)
   * translate to 400 without modifying any row.
   */
  async reorderProjects(
    actor: AuthenticatedUser,
    input: ReorderProjectsBody,
  ): Promise<ProjectEntity[]> {
    this.requireProfessional(actor);

    try {
      return await this.projects.reorder(actor.userId, input.projectIds);
    } catch (error) {
      if (error instanceof ProjectReorderOwnershipError) {
        throw new BadRequestError(
          "The supplied project list does not match your projects.",
        );
      }

      throw error;
    }
  }

  // ── Public search ─────────────────────────────────────────────────────────

  searchPublishedProjects(
    input: ListPublishedProjectsQueryParams,
  ): Promise<PublishedProjectResult> {
    return this.projects.searchPublished({
      page: Number(input.page ?? "1"),
      limit: Number(input.limit ?? "20"),
      ...(input.search !== undefined ? { search: input.search } : {}),
      ...(input.projectType !== undefined
        ? { projectType: input.projectType }
        : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
    });
  }

  /**
   * Returns a PUBLISHED project with safe public owner info.
   * Non-published projects are reported as missing (404) so draft/hidden
   * existence is never exposed to anonymous callers.
   */
  async getPublicProject(projectId: string): Promise<PublicProjectDetail> {
    const project = await this.projects.findPublicById(projectId);

    if (!project) {
      throw new NotFoundError("Project not found.");
    }

    return project;
  }

  // ── Linked procurement (owner-private) ────────────────────────────────────

  /**
   * Lists the RFQs and orders attached to one of the authenticated
   * professional's own projects.
   *
   * This data is owner-private and is deliberately NOT merged into the public
   * project detail payload: procurement reveals what a professional is buying,
   * from where, and for how much. Anonymous and non-owner callers get the same
   * 404 a missing project produces, so linkage existence never leaks.
   */
  async getProjectProcurement(
    actor: AuthenticatedUser,
    projectId: string,
  ): Promise<ProjectProcurementSummary> {
    this.requireProfessional(actor);

    // Ownership gate. Throws NotFoundError for both foreign and missing IDs.
    await this.getMyProject(actor, projectId);

    return this.projects.findProcurement(projectId);
  }

  /**
   * Clears the project link on one RFQ attached to the caller's project.
   *
   * This is the counterpart to the ON DELETE RESTRICT foreign keys: a project
   * cannot be deleted while procurement points at it, and the RFQ update
   * endpoint only accepts OPEN, quote-free requests, so without an explicit
   * detach an owner could be permanently unable to delete a project. The RFQ
   * itself is untouched — only the project link is cleared.
   */
  async detachProjectRfq(
    actor: AuthenticatedUser,
    projectId: string,
    rfqId: string,
  ): Promise<void> {
    this.requireProfessional(actor);

    // Ownership gate. Throws NotFoundError for both foreign and missing IDs.
    await this.getMyProject(actor, projectId);

    if (!(await this.projects.detachRfq(projectId, rfqId))) {
      throw new NotFoundError(
        "No request for quote with that ID is attached to this project.",
      );
    }
  }

  /**
   * Clears the project link on one order attached to the caller's project.
   * Orders have no update endpoint, so this is the only way to release a
   * project that order history points at. The order itself is untouched.
   */
  async detachProjectOrder(
    actor: AuthenticatedUser,
    projectId: string,
    orderId: string,
  ): Promise<void> {
    this.requireProfessional(actor);

    await this.getMyProject(actor, projectId);

    if (!(await this.projects.detachOrder(projectId, orderId))) {
      throw new NotFoundError(
        "No order with that ID is attached to this project.",
      );
    }
  }

  /**
   * Resolves an optional procurement project reference supplied by an RFQ or
   * order write. Returns null when no project was requested, so standalone
   * procurement keeps its existing behaviour untouched.
   *
   * Callers are the RFQ and order services; the check runs BEFORE they open
   * their (serializable) write transactions, so no project read is added
   * inside a latency-sensitive transaction window.
   */
  async resolveProcurementProject(
    actor: AuthenticatedUser,
    projectId: string | undefined,
  ): Promise<string | null> {
    if (projectId === undefined) {
      return null;
    }

    // Only PROFESSIONAL accounts can own projects, so only they can attach
    // one. CUSTOMER buyers share the purchasing routes, which is exactly why
    // this cannot be inferred from the routes' buyer guard.
    if (actor.role !== "PROFESSIONAL") {
      throw new ForbiddenError(
        "Only professional accounts can attach procurement to a project.",
      );
    }

    const project = await this.projects.findById(projectId);

    // Foreign and missing project IDs are indistinguishable, matching every
    // other project lookup, so ownership cannot be probed through this field.
    if (!project || project.ownerId !== actor.userId) {
      throw new NotFoundError("Project not found.");
    }

    // Terminal projects no longer accept new procurement.
    if (project.status === "COMPLETED" || project.status === "CANCELLED") {
      throw new ConflictError(
        `A ${project.status.toLowerCase()} project cannot accept new procurement.`,
      );
    }

    return project.id;
  }

  /**
   * Resolves the display summary of a project that an RFQ or order points at.
   *
   * Callers are the RFQ and order detail reads, which also serve sellers
   * (quoting on a request) and administrators (oversight). Ownership is the
   * only gate: a project the caller does not own returns null, so those
   * viewers see the same thing they see for standalone procurement and the
   * buyer's project never leaks through a purchase they can read.
   *
   * A stale link — the row still points at a project this actor cannot
   * resolve — also degrades to null rather than failing the whole read.
   */
  async findProcurementProjectSummary(
    actor: AuthenticatedUser,
    projectId: string,
  ): Promise<ProcurementProjectSummary | null> {
    // Only PROFESSIONAL accounts can own projects, so nobody else can be the
    // owner of this link. Skipping the read keeps customer and seller detail
    // pages at exactly the query count they had before.
    if (actor.role !== "PROFESSIONAL") {
      return null;
    }

    const project = await this.projects.findById(projectId);

    if (!project || project.ownerId !== actor.userId) {
      return null;
    }

    return {
      id: project.id,
      title: project.title,
      status: project.status,
    };
  }

  // ── Lifecycle transitions ─────────────────────────────────────────────────

  /**
   * Transitions a project's status after validating the move against the
   * lifecycle state machine. Publishing stamps publishedAt on first
   * publication only; that timestamp is preserved through every later
   * transition, including withdrawal back to DRAFT, so it always records the
   * original publication date.
   */
  async changeProjectStatus(
    actor: AuthenticatedUser,
    projectId: string,
    input: ChangeProjectStatusBody,
  ): Promise<ProjectEntity> {
    this.requireProfessional(actor);

    const project = await this.projects.findById(projectId);

    if (!project || project.ownerId !== actor.userId) {
      throw new NotFoundError("Project not found.");
    }

    const nextStatus = input.status;
    const allowed = VALID_STATUS_TRANSITIONS[project.status];

    if (!allowed.includes(nextStatus)) {
      throw new BadRequestError(
        `A ${project.status.toLowerCase()} project cannot change status to ${nextStatus.toLowerCase()}.`,
      );
    }

    // Completion asserts the work is finished, so it is blocked while linked
    // procurement is still in flight. CANCELLED is deliberately NOT guarded:
    // abandoning a project is exactly when open RFQs and orders are expected,
    // and the RFQ/order records keep their own independent lifecycles.
    if (nextStatus === "COMPLETED") {
      await this.requireSettledProcurement(projectId);
    }

    const data: UpdateProjectInput = { status: nextStatus };

    if (nextStatus === "PUBLISHED" && project.publishedAt === null) {
      data.publishedAt = new Date();
    }

    const updated = await this.projects.update(
      projectId,
      actor.userId,
      data,
    );

    if (!updated) {
      throw new NotFoundError("Project not found.");
    }

    return updated;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Blocks project completion while linked procurement is unfinished, and
   * names what is outstanding so the professional knows what to clear.
   */
  private async requireSettledProcurement(projectId: string): Promise<void> {
    const { openRfqs, activeOrders } =
      await this.projects.countActiveProcurement(projectId);

    if (openRfqs === 0 && activeOrders === 0) {
      return;
    }

    const outstanding = [
      openRfqs > 0
        ? `${openRfqs} open ${openRfqs === 1 ? "request" : "requests"} for quote`
        : null,
      activeOrders > 0
        ? `${activeOrders} unfinished ${activeOrders === 1 ? "order" : "orders"}`
        : null,
    ].filter((part): part is string => part !== null);

    throw new ConflictError(
      `This project still has ${outstanding.join(" and ")}. Close them before marking the project completed.`,
    );
  }

  /**
   * Project mutations and own-project reads are restricted to PROFESSIONAL
   * accounts. This mirrors the seller services' requireSeller defense-in-depth:
   * the route-level authorizeRoles("PROFESSIONAL") guard stops requests early,
   * while this check keeps the service contract safe for any caller.
   */
  private requireProfessional(actor: AuthenticatedUser): void {
    if (actor.role !== "PROFESSIONAL") {
      throw new ForbiddenError("Professional access is required.");
    }
  }

  /**
   * Maps validated request fields onto the repository update input. Status
   * and publishedAt are deliberately excluded — they change only through
   * changeProjectStatus.
   */
  private toUpdateInput(input: UpdateProjectBody): UpdateProjectInput {
    return {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.projectType !== undefined
        ? { projectType: input.projectType }
        : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.budget !== undefined ? { budget: input.budget } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
      ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
      ...(input.images !== undefined ? { images: input.images } : {}),
      ...(input.displayOrder !== undefined
        ? { displayOrder: input.displayOrder }
        : {}),
    };
  }
}
