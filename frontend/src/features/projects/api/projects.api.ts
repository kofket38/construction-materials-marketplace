import type { ApiSuccessResponse } from "@/shared/api/api.types";
import { apiClient } from "@/shared/api/http-client";

// ── Entity types (mirroring the Milestone 2A backend contract) ────────────────

export type ProjectStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export interface Project {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  projectType: string | null;
  location: string | null;
  /** Fixed two-decimal string, or null when the project has no budget. */
  budget: string | null;
  startDate: string | null;
  endDate: string | null;
  images: string[];
  displayOrder: number;
  status: ProjectStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface CreateProjectInput {
  title: string;
  description?: string | null;
  projectType?: string | null;
  location?: string | null;
  budget?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  images?: string[];
  displayOrder?: number;
}

export type UpdateProjectInput = Partial<CreateProjectInput>;

// ── API calls ─────────────────────────────────────────────────────────────────

type ProjectListData = { projects: Project[] };
type ProjectData = { project: Project };

/** Lists every project owned by the authenticated user in backend order. */
export async function getMyProjects(signal?: AbortSignal): Promise<Project[]> {
  const res = await apiClient.get<ApiSuccessResponse<ProjectListData>>(
    "/projects/me",
    { signal },
  );
  return res.data.data.projects;
}

/** Fetches one owned project in any status. Non-owned IDs return 404. */
export async function getMyProjectById(
  projectId: string,
  signal?: AbortSignal,
): Promise<Project> {
  const res = await apiClient.get<ApiSuccessResponse<ProjectData>>(
    `/projects/${encodeURIComponent(projectId)}`,
    { signal },
  );
  return res.data.data.project;
}

export async function createProject(
  input: CreateProjectInput,
): Promise<Project> {
  const res = await apiClient.post<ApiSuccessResponse<ProjectData>>(
    "/projects",
    input,
  );
  return res.data.data.project;
}

export async function updateProject(
  projectId: string,
  input: UpdateProjectInput,
): Promise<Project> {
  const res = await apiClient.patch<ApiSuccessResponse<ProjectData>>(
    `/projects/${encodeURIComponent(projectId)}`,
    input,
  );
  return res.data.data.project;
}

/**
 * Lifecycle transitions MUST go through the dedicated status endpoint so the
 * backend state machine stays authoritative.
 */
export async function changeProjectStatus(
  projectId: string,
  status: ProjectStatus,
): Promise<Project> {
  const res = await apiClient.patch<ApiSuccessResponse<ProjectData>>(
    `/projects/${encodeURIComponent(projectId)}/status`,
    { status },
  );
  return res.data.data.project;
}

export async function deleteProject(projectId: string): Promise<void> {
  await apiClient.delete(`/projects/${encodeURIComponent(projectId)}`);
}

/**
 * Applies a full reorder for the owner's projects. The payload key is
 * `projectIds`, matching the implemented backend contract exactly.
 */
export async function reorderProjects(projectIds: string[]): Promise<Project[]> {
  const res = await apiClient.put<ApiSuccessResponse<ProjectListData>>(
    "/projects/me/reorder",
    { projectIds },
  );
  return res.data.data.projects;
}
