import type { AuthenticatedUser } from "../types/auth.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../utils/api-error.js";
import { ProjectReorderOwnershipError } from "../repositories/project.errors.js";
import type {
  CreateProjectInput,
  ProjectEntity,
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

    const deleted = await this.projects.delete(projectId, actor.userId);

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
