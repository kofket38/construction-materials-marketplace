import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";import { Building2, X } from "lucide-react";
import { Link, NavLink } from "react-router-dom";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DashboardNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface DashboardNavGroup {
  /** Optional group label shown above the items */
  label?: string;
  items: DashboardNavItem[];
}

export interface DashboardSidebarProps {
  /** Short workspace title shown below the CMM brand */
  workspaceTitle: string;
  /** Role label shown under the workspace title, e.g. "Seller" */
  workspaceRole: ReactNode;
  /** Navigation groups to render */
  groups: DashboardNavGroup[];
  /** Optional links rendered below the nav groups after a separator */
  secondaryLinks?: DashboardNavItem[];
  /** Whether the mobile drawer is currently open */
  mobileOpen: boolean;
  /** Called when the mobile drawer should close */
  onMobileClose: () => void;
  /** Optional workspace footer content, e.g. account card with sign-out */
  footer?: ReactNode;
}

// ── Nav link class ─────────────────────────────────────────────────────────────

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? "bg-emerald-50 text-emerald-800"
      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
  }`;

// ── Secondary (non-active-state) link class ───────────────────────────────────

const secondaryLinkClass =
  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950";

// ── Sidebar inner content (shared between desktop and mobile drawer) ───────────

function SidebarContent({
  footer,
  groups,
  onClose,
  secondaryLinks,
  workspaceRole,
  workspaceTitle,
}: Omit<DashboardSidebarProps, "mobileOpen" | "onMobileClose"> & {
  onClose?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Brand + workspace header */}
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4">
        <Link
          className="flex min-w-0 items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700"
          to="/"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-emerald-700 text-white">
            <Building2 aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-950">
              {workspaceTitle}
            </p>
            <p className="text-xs font-medium text-emerald-700">
              {workspaceRole}
            </p>
          </div>
        </Link>
        {/* Mobile close button */}
        {onClose ? (
          <button
            aria-label="Close navigation"
            className="flex size-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 lg:hidden"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>

      {/* Navigation */}
      <nav
        aria-label="Dashboard navigation"
        className="flex-1 overflow-y-auto p-3"
      >
        {groups.map((group, groupIndex) => (
          <div
            className={groupIndex > 0 ? "mt-4 border-t border-zinc-200 pt-4" : ""}
            key={groupIndex}
          >
            {group.label ? (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                {group.label}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map(({ href, icon: Icon, label }) => (
                <li key={href}>
                  <NavLink
                    className={navLinkClass}
                    onClick={onClose}
                    to={href}
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Secondary links (e.g. external sections) */}
        {secondaryLinks && secondaryLinks.length > 0 ? (
          <div className="mt-4 border-t border-zinc-200 pt-4">
            <ul className="space-y-0.5">
              {secondaryLinks.map(({ href, icon: Icon, label }) => (
                <li key={href}>
                  <Link
                    className={secondaryLinkClass}
                    onClick={onClose}
                    to={href}
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </nav>

      {/* Workspace-provided footer */}
      {footer ? (
        <div className="shrink-0 border-t border-zinc-200 p-3">{footer}</div>
      ) : null}
    </div>
  );
}

// ── Exported sidebar ───────────────────────────────────────────────────────────

export function DashboardSidebar({
  footer,
  groups,
  mobileOpen,
  onMobileClose,
  secondaryLinks,
  workspaceRole,
  workspaceTitle,
}: DashboardSidebarProps) {
  return (
    <>
      {/* Desktop sidebar — always visible on lg+ */}
      <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-white lg:flex lg:flex-col">
        <SidebarContent
          footer={footer}
          groups={groups}
          secondaryLinks={secondaryLinks}
          workspaceRole={workspaceRole}
          workspaceTitle={workspaceTitle}
        />
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          {/* Backdrop */}
          <div
            aria-hidden="true"
            className="fixed inset-0 bg-zinc-950/40"
            onClick={onMobileClose}
          />
          {/* Drawer */}
          <aside className="relative z-50 flex w-72 flex-col border-r border-zinc-200 bg-white shadow-xl">
            <SidebarContent
              footer={footer}
              groups={groups}
              onClose={onMobileClose}
              secondaryLinks={secondaryLinks}
              workspaceRole={workspaceRole}
              workspaceTitle={workspaceTitle}
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}
