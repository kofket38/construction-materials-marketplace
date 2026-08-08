import {
  AlertTriangle,
  BadgeCheck,
  CircleDollarSign,
  Clock3,
  LoaderCircle,
  PackageCheck,
  ReceiptText,
  Settings,
  ShoppingBag,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";

import { useAuthStore } from "@/features/auth/model/auth.store";
import { getSellerDashboard } from "@/features/seller/api/seller-orders.api";
import { formatProductPrice } from "@/features/products/lib/product-display";
import { getApiErrorMessage } from "@/shared/api/http-error";
import { FullPageStatus } from "@/shared/ui/FullPageStatus";

type SellerWorkspaceSection = "payments" | "sales" | "settings";

export function SellerWorkspacePage({
  section,
}: {
  section: SellerWorkspaceSection;
}) {
  const authStatus = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const dashboardQuery = useQuery({
    queryKey: ["seller", "dashboard"],
    enabled:
      section !== "settings" &&
      authStatus === "authenticated" &&
      user?.role === "SELLER",
    queryFn: ({ signal }) => getSellerDashboard(signal),
    refetchInterval: 30_000,
  });

  if (authStatus !== "authenticated" || !user) {
    return (
      <Navigate
        replace
        state={{ returnTo: `/seller/${section}` }}
        to="/login"
      />
    );
  }
  if (user.role !== "SELLER") {
    return <Navigate replace to="/products" />;
  }
  if (section !== "settings" && dashboardQuery.isPending) {
    return (
      <FullPageStatus
        description={`Loading seller ${section}.`}
        icon={LoaderCircle}
        title="Loading"
      />
    );
  }
  if (
    section !== "settings" &&
    (dashboardQuery.isError || !dashboardQuery.data)
  ) {
    return (
      <FullPageStatus
        action={{
          label: "Try again",
          onClick: () => void dashboardQuery.refetch(),
        }}
        description={getApiErrorMessage(
          dashboardQuery.error,
          `Seller ${section} could not be loaded.`,
        )}
        icon={AlertTriangle}
        title={`${capitalize(section)} unavailable`}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="border-b border-zinc-200 pb-6">
        <p className="text-sm font-semibold text-emerald-700">
          Seller workspace
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">
          {capitalize(section)}
        </h1>
      </div>

      {section === "payments" && dashboardQuery.data ? (
        <div className="mt-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <WorkspaceMetric
              icon={Clock3}
              label="Pending Payment Verification"
              value={dashboardQuery.data.pendingPaymentVerification.toLocaleString()}
            />
            <WorkspaceMetric
              icon={BadgeCheck}
              label="Payment Verified"
              value={dashboardQuery.data.paymentVerified.toLocaleString()}
            />
          </div>
          <Link
            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            to="/seller/orders?status=PENDING_PAYMENT_VERIFICATION"
          >
            <ReceiptText aria-hidden="true" className="size-4" />
            Review payment orders
          </Link>
        </div>
      ) : null}

      {section === "sales" && dashboardQuery.data ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <WorkspaceMetric
            icon={ShoppingBag}
            label="Total Orders"
            value={dashboardQuery.data.totalOrders.toLocaleString()}
          />
          <WorkspaceMetric
            icon={PackageCheck}
            label="Delivered"
            value={dashboardQuery.data.delivered.toLocaleString()}
          />
          <WorkspaceMetric
            icon={CircleDollarSign}
            label="Revenue"
            value={formatProductPrice(dashboardQuery.data.totalRevenue)}
          />
        </div>
      ) : null}

      {section === "settings" ? (
        <section className="mt-6" aria-labelledby="account-settings-heading">
          <div className="flex items-center gap-3">
            <Settings
              aria-hidden="true"
              className="size-5 text-emerald-700"
            />
            <h2
              className="text-xl font-semibold text-zinc-950"
              id="account-settings-heading"
            >
              Account
            </h2>
          </div>
          <dl className="mt-4 grid gap-5 border-y border-zinc-200 py-5 sm:grid-cols-2">
            <AccountDetail label="Name" value={user.name} />
            <AccountDetail label="Email" value={user.email} />
            <AccountDetail label="Phone" value={user.phone} />
            <AccountDetail label="Company" value={user.company} />
          </dl>
        </section>
      ) : null}
    </main>
  );
}

function WorkspaceMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm">
      <Icon aria-hidden="true" className="size-5 text-emerald-700" />
      <p className="mt-4 text-sm text-zinc-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function AccountDetail({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-zinc-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-zinc-950">
        {value || "Not provided"}
      </dd>
    </div>
  );
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
