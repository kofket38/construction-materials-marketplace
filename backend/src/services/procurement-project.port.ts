import type { AuthenticatedUser } from "../types/auth.js";

/**
 * Narrow port the purchasing services use to attach procurement to a
 * professional's project.
 *
 * ProjectService satisfies this structurally. Keeping the dependency this
 * small means the RFQ and order services can resolve a project link without
 * gaining access to project creation, editing, or lifecycle transitions.
 */
export interface ProcurementProjectLinker {
  /**
   * Validates an optional project reference supplied by an RFQ or order write
   * and returns the project ID to persist, or null when the caller did not ask
   * for a project.
   *
   * Throws ForbiddenError for non-professional callers, NotFoundError for
   * missing or foreign projects, and ConflictError for terminal projects.
   */
  resolveProcurementProject(
    actor: AuthenticatedUser,
    projectId: string | undefined,
  ): Promise<string | null>;
}
