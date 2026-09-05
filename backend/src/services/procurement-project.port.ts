import type { ProjectStatus } from "../repositories/project.repository.js";
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

  /**
   * Display summary of a project that one of the actor's own purchases points
   * at, or null when the actor does not own that project.
   *
   * Unlike resolveProcurementProject this never throws. It runs on read paths
   * that are also served to sellers and administrators, where a project the
   * caller does not own must read exactly like no project at all — the same
   * indistinguishability every other project lookup applies.
   */
  findProcurementProjectSummary(
    actor: AuthenticatedUser,
    projectId: string,
  ): Promise<ProcurementProjectSummary | null>;
}

/**
 * Display summary of the project an RFQ or order is attached to. Deliberately
 * a summary rather than the whole project: the purchasing surfaces only need
 * enough to name it and link through to the project page, which applies its
 * own authorization.
 */
export interface ProcurementProjectSummary {
  id: string;
  title: string;
  status: ProjectStatus;
}

/** Any record that can carry a project link. */
interface ProjectLinkedRecord {
  projectId: string | null;
}

/**
 * A detail-read payload with its project link resolved. The field is always
 * present so a caller can never confuse "not attached" with "this response
 * does not carry the link".
 */
export type WithProcurementProject<T> = T & {
  project: ProcurementProjectSummary | null;
};

/**
 * Resolves the project attached to one RFQ or order for display.
 *
 * Shared by the RFQ and order services so their two detail responses cannot
 * drift, and so the owner-only rule lives in exactly one place. A standalone
 * record skips the lookup entirely, which is every customer purchase.
 */
export async function attachProcurementProject<T extends ProjectLinkedRecord>(
  linker: ProcurementProjectLinker,
  actor: AuthenticatedUser,
  record: T,
): Promise<WithProcurementProject<T>> {
  if (record.projectId === null) {
    return { ...record, project: null };
  }

  return {
    ...record,
    project: await linker.findProcurementProjectSummary(
      actor,
      record.projectId,
    ),
  };
}
