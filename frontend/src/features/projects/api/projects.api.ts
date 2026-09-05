import type { OrderStatus } from "@/features/orders/model/order";
import type { RfqStatus } from "@/features/rfq/model/rfq";
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

// ── Public discovery types ────────────────────────────────────────────────────

/**
 * Safe professional info attached to a public project card.
 * Only present when the owner has a PUBLIC professional profile.
 * Never contains phone, email, userId, or any User-level fields.
 */
export interface PublicOwnerInfo {
  /** ProfessionalProfile.id — links to /professionals/:profileId */
  profileId: string;
  displayName: string;
  headline: string | null;
  profession: string | null;
  avatarUrl: string | null;
  city: string | null;
  country: string | null;
}

/** Richer owner info for the public project detail page. */
export interface PublicOwnerDetailInfo extends PublicOwnerInfo {
  yearsExperience: number | null;
  company: string | null;
  region: string | null;
  website: string | null;
  linkedinUrl: string | null;
  specialties: string[];
}

/** Published project card shape — no ownerId, no displayOrder, no updatedAt. */
export interface PublicProjectItem {
  id: string;
  title: string;
  description: string | null;
  projectType: string | null;
  location: string | null;
  budget: string | null;
  startDate: string | null;
  endDate: string | null;
  images: string[];
  status: ProjectStatus;
  publishedAt: string | null;
  owner: PublicOwnerInfo | null;
}

/** Full public project detail with richer owner info. */
export interface PublicProjectDetail extends PublicProjectItem {
  owner: PublicOwnerDetailInfo | null;
}

export interface PublishedProjectsResult {
  projects: PublicProjectItem[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface GetPublishedProjectsInput {
  page?: number;
  limit?: number;
  search?: string;
  projectType?: string;
  location?: string;
  /** Filter by owner User.id (not profile id). */
  ownerId?: string;
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

// ── Procurement link types (owner-private) ────────────────────────────────────

/**
 * The project an RFQ or order is attached to, as named on the buyer's own
 * detail read of that purchase.
 *
 * The backend fills this in for the project owner only: sellers quoting a
 * request and administrators reviewing one read null, exactly as they do for
 * standalone procurement, so a buyer's project never leaks through a purchase
 * somebody else may legitimately open.
 */
export interface LinkedProjectSummary {
  id: string;
  title: string;
  status: ProjectStatus;
}

/**
 * An RFQ attached to a project, as summarised by the owner procurement view.
 * Dates arrive as ISO strings; the backend `Date` fields are JSON-serialised.
 */
export interface ProjectRfqSummary {
  id: string;
  title: string;
  status: RfqStatus;
  deliveryLocation: string;
  itemCount: number;
  quoteCount: number;
  expiresAt: string;
  createdAt: string;
}

/** An order attached to a project. */
export interface ProjectOrderSummary {
  id: string;
  status: OrderStatus;
  /** Fixed two-decimal string, matching the order total. */
  totalAmount: string;
  itemCount: number;
  createdAt: string;
}

/**
 * Everything the project owner sees about procurement linked to one project.
 * Owner-private — it is never part of the public project detail payload.
 */
export interface ProjectProcurementSummary {
  rfqs: ProjectRfqSummary[];
  orders: ProjectOrderSummary[];
}

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

// ── Procurement link API calls ────────────────────────────────────────────────

/**
 * Owner-private view of the RFQs and orders attached to one project. Foreign
 * and non-existent project IDs both return 404, so callers must not treat a
 * 404 as proof the project is missing.
 */
export async function getProjectProcurement(
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectProcurementSummary> {
  const res = await apiClient.get<
    ApiSuccessResponse<ProjectProcurementSummary>
  >(`/projects/${encodeURIComponent(projectId)}/procurement`, { signal });
  return res.data.data;
}

/**
 * Clears the project link on one attached RFQ. The RFQ itself is untouched —
 * this only releases it from the project so the owner is never permanently
 * blocked from deleting the project by the ON DELETE RESTRICT foreign keys.
 */
export async function detachProjectRfq(
  projectId: string,
  rfqId: string,
): Promise<void> {
  await apiClient.delete(
    `/projects/${encodeURIComponent(projectId)}/procurement/rfqs/${encodeURIComponent(rfqId)}`,
  );
}

/** Clears the project link on one attached order. The order is untouched. */
export async function detachProjectOrder(
  projectId: string,
  orderId: string,
): Promise<void> {
  await apiClient.delete(
    `/projects/${encodeURIComponent(projectId)}/procurement/orders/${encodeURIComponent(orderId)}`,
  );
}

// ── Public discovery API calls ────────────────────────────────────────────────

/**
 * Searches published projects for public/anonymous discovery.
 * No authentication required. Only PUBLISHED projects are ever returned —
 * the backend enforces this at the database-query level.
 */
export async function getPublishedProjects(
  input: GetPublishedProjectsInput,
  signal?: AbortSignal,
): Promise<PublishedProjectsResult> {
  const res = await apiClient.get<ApiSuccessResponse<PublishedProjectsResult>>(
    "/projects",
    { params: input, signal },
  );
  return res.data.data;
}

/**
 * Fetches a single published project with safe owner info for the public
 * detail page. Returns the enriched PublicProjectDetail shape.
 * Non-published projects return 404 — the backend never reveals their
 * existence to anonymous callers.
 */
export async function getPublicProjectById(
  projectId: string,
  signal?: AbortSignal,
): Promise<PublicProjectDetail> {
  const res = await apiClient.get<ApiSuccessResponse<{ project: PublicProjectDetail }>>(
    `/projects/${encodeURIComponent(projectId)}`,
    { signal },
  );
  return res.data.data.project;
}
