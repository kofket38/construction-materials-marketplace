import { LogOut } from "lucide-react";

import { useAuthStore } from "@/features/auth/model/auth.store";
import { useSignOut } from "@/features/auth/model/use-sign-out";

// ── Workspace account footer ──────────────────────────────────────────────────
//
// Account card rendered at the bottom of workspace sidebars (Seller,
// Professional). After sign-out the session is cleared and router-level
// protection redirects to /login.

export function WorkspaceAccountFooter() {
  const user = useAuthStore((state) => state.user);
  const { isSigningOut, signOut } = useSignOut();

  const initials = user?.name
    ? user.name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .join("")
    : "?";

  return (
    <>
      <div className="mb-1 flex items-center gap-3 rounded-md px-3 py-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-700">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-950">
            {user?.name ?? "—"}
          </p>
          <p className="truncate text-xs text-zinc-500">
            {user?.email ?? "—"}
          </p>
        </div>
      </div>
      <button
        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 disabled:opacity-60"
        disabled={isSigningOut}
        onClick={() => void signOut()}
        type="button"
      >
        <LogOut aria-hidden="true" className="size-4 shrink-0" />
        {isSigningOut ? "Signing out…" : "Sign out"}
      </button>
    </>
  );
}
