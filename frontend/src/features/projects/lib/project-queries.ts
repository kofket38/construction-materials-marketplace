import { useQueryClient } from "@tanstack/react-query";
import type { GetPublishedProjectsInput } from "@/features/projects/api/projects.api";

// ── Query keys (dedicated "projects" namespace) ───────────────────────────────

export const MY_PROJECTS_KEY = ["projects", "me"] as const;

export function ownerProjectKey(projectId: string) {
  return ["projects", "owner", projectId] as const;
}

/**
 * Query key for the owner-private procurement view of one project. It lives in
 * the same "projects" namespace so useInvalidateProjects refreshes it too.
 */
export function projectProcurementKey(projectId: string) {
  return ["projects", "procurement", projectId] as const;
}

// ── Public discovery query keys ───────────────────────────────────────────────

/**
 * Deterministic query key for the public project list. All filter/pagination
 * params are included so React Query caches each unique search separately and
 * keepPreviousData can transition smoothly between pages.
 */
export function publicProjectsKey(input: GetPublishedProjectsInput) {
  return [
    "projects",
    "public",
    "list",
    {
      page: input.page ?? 1,
      limit: input.limit ?? 20,
      search: input.search ?? "",
      projectType: input.projectType ?? "",
      location: input.location ?? "",
      ownerId: input.ownerId ?? "",
    },
  ] as const;
}

/** Query key for a single public project detail. */
export function publicProjectKey(projectId: string) {
  return ["projects", "public", "detail", projectId] as const;
}

/**
 * Invalidates every query in the dedicated "projects" namespace after a
 * mutation so owner lists and project details refetch consistently.
 */
export function useInvalidateProjects() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ["projects"] });
}
