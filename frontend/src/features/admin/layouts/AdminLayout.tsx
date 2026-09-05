import {
  BarChart3,
  Boxes,
  LogOut,
  Package,
  ShoppingBag,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";

import { useAuthStore } from "@/features/auth/model/auth.store";
import { useSignOut } from "@/features/auth/model/use-sign-out";
import {
  DashboardShell,
  type DashboardNavItem,
  type DashboardNavGroup,
} from "@/shared/layouts/dashboard";
import { ThemeToggle } from "@/shared/theme/ThemeToggle";

// ── Admin navigation ─────────────────────────────────────────────────────────

const ADMIN_NAV_GROUPS: DashboardNavGroup[] = [
  {
    items: [
      { label: "Dashboard", href: "/admin/dashboard", icon: BarChart3 },
      { label: "Users",     href: "/admin/users",     icon: Users },
      { label: "Sellers",   href: "/admin/sellers",   icon: Store },
      { label: "Products",  href: "/admin/products",  icon: Boxes },
      { label: "Orders",    href: "/admin/orders",    icon: ShoppingBag },
    ],
  },
];

const ADMIN_SECONDARY_LINKS: DashboardNavItem[] = [
  { label: "View marketplace", href: "/products", icon: Package },
];

// ── Account footer ────────────────────────────────────────────────────────────

function AdminSidebarFooter() {
  const user = useAuthStore((state) => state.user);
  const { isSigningOut, signOut } = useSignOut({ redirectTo: "/login" });

  return (
    <>
      {/* The admin shell is a sibling of PublicLayout, so it has no public
          header to inherit a theme control from — it carries its own. */}
      <ThemeToggle className="mb-2 w-full" layout="labelled" />
      <div className="mb-1 flex items-center gap-3 rounded-md px-3 py-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-700">
          {user?.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-950">
            {user?.name}
          </p>
          <p className="truncate text-xs text-zinc-500">{user?.email}</p>
        </div>
      </div>
      <button
        className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 disabled:opacity-60"
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

// ── Layout route ──────────────────────────────────────────────────────────────

export function AdminLayout() {
  return (
    <DashboardShell
      footer={<AdminSidebarFooter />}
      groups={ADMIN_NAV_GROUPS}
      secondaryLinks={ADMIN_SECONDARY_LINKS}
      workspaceRole={
        <span className="flex items-center gap-1">
          <ShieldCheck aria-hidden="true" className="size-3" />
          Administrator
        </span>
      }
      workspaceTitle="CMM Admin"
    />
  );
}
