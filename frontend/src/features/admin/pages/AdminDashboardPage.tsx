import {
  AlertTriangle,
  BarChart3,
  Boxes,
  CircleDollarSign,
  LoaderCircle,
  Package,
  RefreshCw,
  ShoppingBag,
  Store,
  Tag,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getAdminDashboard } from "@/features/admin/api/admin.api";
import type { AdminDashboardSummary, AdminRecentActivity } from "@/features/admin/api/admin.api";
import { formatAdminDateTime } from "@/features/admin/lib/admin-display";
import { formatProductPrice } from "@/features/products/lib/product-display";
import { getApiErrorMessage } from "@/shared/api/http-error";
import {
  StatCard,
  type StatCardProps,
} from "@/shared/layouts/dashboard";

const REFRESH_INTERVAL = 60_000;

export function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: ({ signal }) => getAdminDashboard(signal),
    refetchInterval: REFRESH_INTERVAL,
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Administration</p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Dashboard</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Marketplace overview and recent activity.
          </p>
        </div>
        <button
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
          disabled={query.isFetching}
          onClick={() => void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] })}
          type="button"
        >
          <RefreshCw
            aria-hidden="true"
            className={`size-4 ${query.isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {query.isPending ? (
        <div className="flex min-h-64 items-center justify-center">
          <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-emerald-700" />
        </div>
      ) : query.isError ? (
        <div className="mt-8 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {getApiErrorMessage(query.error, "Dashboard could not be loaded.")}
        </div>
      ) : (
        <DashboardContent dashboard={query.data} />
      )}
    </div>
  );
}

function DashboardContent({ dashboard }: { dashboard: AdminDashboardSummary }) {
  const metrics: StatCardProps[] = [
    { icon: Users, iconTone: "bg-zinc-100 text-zinc-700", label: "Total Users", value: dashboard.totalUsers },
    { icon: Users, iconTone: "bg-sky-50 text-sky-700", label: "Customers", value: dashboard.totalCustomers },
    { icon: Store, iconTone: "bg-blue-50 text-blue-700", label: "Sellers", value: dashboard.totalSellers },
    { icon: Boxes, iconTone: "bg-indigo-50 text-indigo-700", label: "Products", value: dashboard.totalProducts },
    { icon: Tag, iconTone: "bg-violet-50 text-violet-700", label: "Categories", value: dashboard.totalCategories },
    { icon: ShoppingBag, iconTone: "bg-amber-50 text-amber-700", label: "Total Orders", value: dashboard.totalOrders },
    { icon: CircleDollarSign, iconTone: "bg-emerald-50 text-emerald-700", label: "This Month Revenue", value: formatProductPrice(dashboard.monthlyRevenue) },
    { icon: BarChart3, iconTone: "bg-emerald-50 text-emerald-700", label: "Total Revenue", value: formatProductPrice(dashboard.totalRevenue) },
  ];

  return (
    <>
      <section aria-label="Marketplace metrics" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <StatCard key={m.label} {...m} />
        ))}
      </section>

      <section aria-labelledby="activity-heading" className="mt-10">
        <h2 className="text-xl font-semibold text-zinc-950" id="activity-heading">
          Recent Activity
        </h2>
        <div className="mt-4 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm">
          {dashboard.recentActivity.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-zinc-500">
              <Package aria-hidden="true" className="mr-2 size-4" />
              No recent activity.
            </div>
          ) : (
            <ul aria-label="Recent activity feed" className="divide-y divide-zinc-200">
              {dashboard.recentActivity.map((item) => (
                <ActivityRow item={item} key={`${item.entityId}-${item.type}`} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}

function ActivityRow({ item }: { item: AdminRecentActivity }) {
  const iconMap: Record<string, LucideIcon> = {
    USER_REGISTERED: Users,
    PRODUCT_CREATED: Boxes,
    ORDER_CREATED: ShoppingBag,
  };
  const toneMap: Record<string, string> = {
    USER_REGISTERED: "bg-sky-50 text-sky-700",
    PRODUCT_CREATED: "bg-indigo-50 text-indigo-700",
    ORDER_CREATED: "bg-amber-50 text-amber-700",
  };
  const Icon = iconMap[item.type] ?? Package;
  const tone = toneMap[item.type] ?? "bg-zinc-100 text-zinc-600";

  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <p className="flex-1 text-sm text-zinc-800">{item.label}</p>
      <time
        className="shrink-0 text-xs text-zinc-400"
        dateTime={item.createdAt}
        title={item.createdAt}
      >
        {formatAdminDateTime(item.createdAt)}
      </time>
    </li>
  );
}
