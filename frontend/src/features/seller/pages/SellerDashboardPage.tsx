import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  Boxes,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  LoaderCircle,
  PackageCheck,
  Truck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";

import { useAuthStore } from "@/features/auth/model/auth.store";
import { OrderStatusBadge } from "@/features/orders/components/OrderStatusBadge";
import {
  formatOrderDate,
  formatOrderNumber,
} from "@/features/orders/lib/order-display";
import { getSellerDashboard } from "@/features/seller/api/seller-orders.api";
import type { SellerDashboardSummary } from "@/features/seller/model/seller-order";
import { formatProductPrice } from "@/features/products/lib/product-display";
import { getApiErrorMessage } from "@/shared/api/http-error";
import { FullPageStatus } from "@/shared/ui/FullPageStatus";

const REFRESH_INTERVAL = 30_000;

export function SellerDashboardPage() {
  const authStatus = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const dashboardQuery = useQuery({
    queryKey: ["seller", "dashboard"],
    enabled:
      authStatus === "authenticated" && user?.role === "SELLER",
    queryFn: ({ signal }) => getSellerDashboard(signal),
    refetchInterval: REFRESH_INTERVAL,
  });

  if (authStatus !== "authenticated" || !user) {
    return (
      <Navigate
        replace
        state={{ returnTo: "/seller/dashboard" }}
        to="/login"
      />
    );
  }
  if (user.role !== "SELLER") {
    return <Navigate replace to="/products" />;
  }
  if (dashboardQuery.isPending) {
    return (
      <FullPageStatus
        description="Loading seller operations."
        icon={LoaderCircle}
        title="Loading dashboard"
      />
    );
  }
  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <FullPageStatus
        action={{
          label: "Try again",
          onClick: () => void dashboardQuery.refetch(),
        }}
        description={getApiErrorMessage(
          dashboardQuery.error,
          "The seller dashboard could not be loaded.",
        )}
        icon={AlertTriangle}
        title="Dashboard unavailable"
      />
    );
  }

  const dashboard = dashboardQuery.data;
  const cards = createDashboardCards(dashboard);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-sm font-semibold text-emerald-700">
            Seller workspace
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">
            Dashboard
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Order fulfillment and payment activity for your products.
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
          to="/seller/orders"
        >
          <ClipboardCheck aria-hidden="true" className="size-4" />
          Manage orders
        </Link>
      </div>

      <section
        aria-label="Order metrics"
        className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {cards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </section>

      <section aria-labelledby="recent-orders-heading" className="mt-10">
        <div className="flex items-center justify-between gap-4">
          <h2
            className="text-xl font-semibold text-zinc-950"
            id="recent-orders-heading"
          >
            Recent orders
          </h2>
          <Link
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            to="/seller/orders"
          >
            View all
          </Link>
        </div>

        {dashboard.recentOrders.length === 0 ? (
          <div className="mt-4 border-y border-zinc-200 py-12 text-center text-sm text-zinc-600">
            No customer orders yet.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto border-y border-zinc-200">
            <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                  <th className="px-3 py-3 font-medium">Order</th>
                  <th className="px-3 py-3 font-medium">Buyer</th>
                  <th className="px-3 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Amount</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {dashboard.recentOrders.slice(0, 6).map((order) => (
                  <tr key={order.id}>
                    <td className="px-3 py-4 font-semibold text-zinc-950">
                      <Link
                        className="hover:text-emerald-700"
                        to={`/seller/orders/${encodeURIComponent(order.id)}`}
                      >
                        {formatOrderNumber(order.id)}
                      </Link>
                    </td>
                    <td className="px-3 py-4 text-zinc-700">
                      {order.customer.name}
                    </td>
                    <td className="px-3 py-4 text-zinc-600">
                      {formatOrderDate(order.createdAt)}
                    </td>
                    <td className="px-3 py-4 font-semibold text-zinc-950">
                      {formatProductPrice(order.sellerTotal)}
                    </td>
                    <td className="px-3 py-4">
                      <OrderStatusBadge status={order.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: string;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: MetricCardProps) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm leading-5 text-zinc-600">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-950">
            {value}
          </p>
        </div>
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-md ${tone}`}
        >
          <Icon aria-hidden="true" className="size-4" />
        </span>
      </div>
    </div>
  );
}

function createDashboardCards(
  dashboard: SellerDashboardSummary,
): MetricCardProps[] {
  return [
    {
      icon: Clock3,
      label: "Pending Payment Verification",
      value: dashboard.pendingPaymentVerification.toLocaleString(),
      tone: "bg-amber-50 text-amber-700",
    },
    {
      icon: BadgeCheck,
      label: "Payment Verified",
      value: dashboard.paymentVerified.toLocaleString(),
      tone: "bg-sky-50 text-sky-700",
    },
    {
      icon: Boxes,
      label: "Processing",
      value: dashboard.processing.toLocaleString(),
      tone: "bg-blue-50 text-blue-700",
    },
    {
      icon: PackageCheck,
      label: "Ready for Delivery",
      value: dashboard.readyForDelivery.toLocaleString(),
      tone: "bg-indigo-50 text-indigo-700",
    },
    {
      icon: Truck,
      label: "Out for Delivery",
      value: dashboard.outForDelivery.toLocaleString(),
      tone: "bg-violet-50 text-violet-700",
    },
    {
      icon: ClipboardCheck,
      label: "Delivered",
      value: dashboard.delivered.toLocaleString(),
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      icon: Banknote,
      label: "Total Orders",
      value: dashboard.totalOrders.toLocaleString(),
      tone: "bg-zinc-100 text-zinc-700",
    },
    {
      icon: CircleDollarSign,
      label: "Revenue",
      value: formatProductPrice(dashboard.totalRevenue),
      tone: "bg-emerald-50 text-emerald-700",
    },
  ];
}
