import { useAuthStore } from "@/features/auth/model/auth.store";

/**
 * Whether the signed-in account can attach procurement to a project.
 *
 * Only PROFESSIONAL accounts own projects, and the backend rejects a projectId
 * from anyone else. Professional accounts are registration-only, so a CUSTOMER
 * never gains this capability mid-session — the correct treatment is to hide
 * the attachment UI entirely rather than to show a disabled or upsell state.
 */
export function useCanAttachProcurement(): boolean {
  return useAuthStore((state) => state.user?.role) === "PROFESSIONAL";
}
