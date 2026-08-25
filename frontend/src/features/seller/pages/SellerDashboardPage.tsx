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
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { OrderStatusBadge } from "@/features/orders/components/OrderStatusBadge";
import {
  formatOrderDate,
  formatOrderNumber,
} from "@/features/orders/lib/order-display";
import { getSellerDashboard } from "@/features/seller/api/seller-orders.api";
import { SellerOnboardingBanner } from "@/features/seller/components/SellerOnboardingBanner";
import type { SellerDashboardSummary } from "@/features/seller/model/seller-order";
import { formatProductPrice } from "@/features/products/lib/product-display";
import { getApiErrorMessage } from "@/shared/api/http-error";
import {
  StatCard,
  type StatCardProps,
} from "@/shared/layouts/dashboard";
import { FullPageStatus } from "@/shared/ui/FullPageStatus";

const REFRESH_INTERVAL = 30_000;

export function SellerDashboardPage() {
  const dashboardQuery = useQuery({
    queryKey: ["seller", "dashboard"],
    queryFn: ({ signal }) => getSellerDashboard(signal),
    refetchInterval: REFRESH_INTERVAL,
  });

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

      {/* Onboarding checklist — hidden once profile + inventory are complete */}
      <div className="mt-6">
        <SellerOnboardingBanner />
      </div>

      <section
        aria-label="Order metrics"
        className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {cards.map((card) => (
          <StatCard key={card.label} {...card} />
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

function createDashboardCards(
  dashboard: SellerDashboardSummary,
): StatCardProps[] {
  return [
    {
      icon: Clock3,
      iconTone: "bg-amber-50 text-amber-700",
      label: "Pending Payment Verification",
      value: dashboard.pendingPaymentVerification,
    },
    {
      icon: BadgeCheck,
      iconTone: "bg-sky-50 text-sky-700",
      label: "Payment Verified",
      value: dashboard.paymentVerified,
    },
    {
      icon: Boxes,
      iconTone: "bg-blue-50 text-blue-700",
      label: "Processing",
      value: dashboard.processing,
    },
    {
      icon: PackageCheck,
      iconTone: "bg-indigo-50 text-indigo-700",
      label: "Ready for Delivery",
      value: dashboard.readyForDelivery,
    },
    {
      icon: Truck,
      iconTone: "bg-violet-50 text-violet-700",
      label: "Out for Delivery",
      value: dashboard.outForDelivery,
    },
    {
      icon: ClipboardCheck,
      iconTone: "bg-emerald-50 text-emerald-700",
      label: "Delivered",
      value: dashboard.delivered,
    },
    {
      icon: Banknote,
      iconTone: "bg-zinc-100 text-zinc-700",
      label: "Total Orders",
      value: dashboard.totalOrders,
    },
    {
      icon: CircleDollarSign,
      iconTone: "bg-emerald-50 text-emerald-700",
      label: "Revenue",
      value: formatProductPrice(dashboard.totalRevenue),
    },
  ];
}
