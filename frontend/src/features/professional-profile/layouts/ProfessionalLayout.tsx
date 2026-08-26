import {
  FilePlus2,
  FolderKanban,
  LayoutDashboard,
  Package,
  Pencil,
  Users,
} from "lucide-react";

import { WorkspaceAccountFooter } from "@/features/auth/components/WorkspaceAccountFooter";
import {
  DashboardShell,
  type DashboardNavItem,
  type DashboardNavGroup,
} from "@/shared/layouts/dashboard";

// ── Professional navigation ──────────────────────────────────────────────────

const PROFESSIONAL_NAV_GROUPS: DashboardNavGroup[] = [
  {
    items: [
      {
        label: "Dashboard",
        href: "/professional/dashboard",
        icon: LayoutDashboard,
      },
      {
        label: "My Projects",
        href: "/professional/projects",
        icon: FolderKanban,
      },
      {
        label: "New Project",
        href: "/professional/projects/new",
        icon: FilePlus2,
      },
      {
        label: "Edit Profile",
        href: "/profile/professional",
        icon: Pencil,
      },
    ],
  },
];

const PROFESSIONAL_SECONDARY_LINKS: DashboardNavItem[] = [
  { label: "Browse Professionals", href: "/professionals", icon: Users },
  { label: "View marketplace", href: "/products", icon: Package },
];

// ── Layout route ──────────────────────────────────────────────────────────────

export function ProfessionalLayout() {
  return (
    <DashboardShell
      footer={<WorkspaceAccountFooter />}
      groups={PROFESSIONAL_NAV_GROUPS}
      secondaryLinks={PROFESSIONAL_SECONDARY_LINKS}
      workspaceRole="Professional workspace"
      workspaceTitle="CMM Professional"
    />
  );
}
