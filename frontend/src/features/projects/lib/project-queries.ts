import { useQueryClient } from "@tanstack/react-query";

// ── Query keys (dedicated "projects" namespace) ───────────────────────────────

export const MY_PROJECTS_KEY = ["projects", "me"] as const;

export function ownerProjectKey(projectId: string) {
  return ["projects", "owner", projectId] as const;
}

/**
 * Invalidates every query in the dedicated "projects" namespace after a
 * mutation so owner lists and project details refetch consistently.
 */
export function useInvalidateProjects() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: ["projects"] });
}
