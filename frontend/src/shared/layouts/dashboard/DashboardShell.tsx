import { Menu } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Outlet } from "react-router-dom";

import type {
  DashboardNavItem,
  DashboardNavGroup,
} from "./DashboardSidebar";
import { CmmLogoLink } from "@/shared/brand/CmmLogo";
import { DashboardSidebar } from "./DashboardSidebar";

export interface DashboardShellProps {
  /** Short workspace title, e.g. "CMM Seller" */
  workspaceTitle: string;
  /** Role label below the title, e.g. "Seller workspace" */
  workspaceRole: ReactNode;
  /** Navigation groups passed to the sidebar */
  groups: DashboardNavGroup[];
  /** Optional links rendered below the nav groups after a separator */
  secondaryLinks?: DashboardNavItem[];
  /** Optional workspace-specific footer rendered at the bottom of the sidebar */
  footer?: ReactNode;
}

export function DashboardShell({
  footer,
  groups,
  secondaryLinks,
  workspaceRole,
  workspaceTitle,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Sidebar */}
      <DashboardSidebar
        footer={footer}
        groups={groups}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        secondaryLinks={secondaryLinks}
        workspaceRole={workspaceRole}
        workspaceTitle={workspaceTitle}
      />

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar. Sticky so the drawer trigger — the only route back to
            workspace navigation below `lg` — never scrolls out of reach. */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-4 lg:hidden">
          <button
            aria-label="Open navigation"
            className="flex size-9 shrink-0 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-brand-ring"
            onClick={() => setMobileOpen(true)}
            type="button"
          >
            <Menu aria-hidden="true" className="size-5" />
          </button>
          <CmmLogoLink size="sm" variant="mark" />
          <span className="min-w-0 truncate font-semibold text-zinc-950">
            {workspaceTitle}
          </span>
        </header>

        {/* Routed workspace content */}
        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
