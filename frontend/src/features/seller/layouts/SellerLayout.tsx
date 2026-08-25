import {
  BarChart3,
  ClipboardList,
  CreditCard,
  FileQuestion,
  LayoutDashboard,
  Package,
  Settings,
  Store,
} from "lucide-react";

import { WorkspaceAccountFooter } from "@/features/auth/components/WorkspaceAccountFooter";
import {
  DashboardShell,
  type DashboardNavGroup,
} from "@/shared/layouts/dashboard";

// ── Seller navigation ─────────────────────────────────────────────────────────

const SELLER_NAV_GROUPS: DashboardNavGroup[] = [
  {
    items: [
      { label: "Dashboard",  href: "/seller/dashboard",  icon: LayoutDashboard },
      { label: "Inventory",  href: "/seller/inventory",  icon: Package },
      { label: "Orders",     href: "/seller/orders",     icon: ClipboardList },
      { label: "RFQs",       href: "/seller/rfqs",       icon: FileQuestion },
      { label: "Payments",   href: "/seller/payments",   icon: CreditCard },
      { label: "Sales",      href: "/seller/sales",      icon: BarChart3 },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Store Profile", href: "/seller/profile",   icon: Store },
      { label: "Settings",      href: "/seller/settings",  icon: Settings },
    ],
  },
];

// ── Layout route ──────────────────────────────────────────────────────────────

export function SellerLayout() {
  return (
    <DashboardShell
      footer={<WorkspaceAccountFooter />}
      groups={SELLER_NAV_GROUPS}
      workspaceRole="Seller workspace"
      workspaceTitle="CMM Seller"
    />
  );
}
