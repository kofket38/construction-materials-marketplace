import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  LoaderCircle,
  PackageOpen,
  Search,
} from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Navigate, useSearchParams } from "react-router-dom";

import { useAuthStore } from "@/features/auth/model/auth.store";
import {
  getSellerOrders,
  type SellerOrdersQuery,
} from "@/features/seller/api/seller-orders.api";
import { PaymentProofStatusBadge } from "@/features/orders/components/PaymentProofStatusBadge";
import { SellerOrderDetailsDialog } from "@/features/orders/components/SellerOrderDetailsDialog";
import { SellerWorkflowStatusBadge } from "@/features/orders/components/SellerWorkflowStatusBadge";
import {
  formatOrderDate,
  formatOrderNumber,
} from "@/features/orders/lib/order-display";
import { formatProductPrice } from "@/features/products/lib/product-display";
import type { SellerOrder } from "@/features/seller/model/seller-order";
import { getApiErrorMessage } from "@/shared/api/http-error";
import { FullPageStatus } from "@/shared/ui/FullPageStatus";

const REFRESH_INTERVAL = 30_000;
const PAGE_SIZE = 20;

const statusOptions: Array<{
  label: string;
  value: SellerOrdersQuery["status"] | "";
}> = [
  { label: "All statuses", value: "" },
  {
    label: "Awaiting payment proof",
    value: "PENDING_PAYMENT_VERIFICATION",
  },
  { label: "Pending", value: "PENDING" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "Processing", value: "PROCESSING" },
  { label: "Shipped", value: "SHIPPED" },
  { label: "Delivered", value: "DELIVERED" },
  { label: "Cancelled", value: "CANCELLED" },
];

export function SellerOrdersPage() {
  const authStatus = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [status, setStatus] = useState<SellerOrdersQuery["status"] | "">(
    getInitialStatus(searchParams.get("status")),
  );
  const selectedOrderId = searchParams.get("orderId");
  const ordersQuery = useQuery({
    queryKey: [
      "seller",
      "orders",
      { customerSearch, page, status },
    ],
    enabled:
      authStatus === "authenticated" && user?.role === "SELLER",
    queryFn: ({ signal }) => {
      const input: SellerOrdersQuery = {
        page,
        limit: PAGE_SIZE,
        ...(customerSearch ? { customerSearch } : {}),
        ...(status ? { status } : {}),
      };
      return getSellerOrders(input, signal);
    },
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH_INTERVAL,
  });

  if (authStatus !== "authenticated" || !user) {
    return (
      <Navigate
        replace
        state={{ returnTo: "/seller/orders" }}
        to="/login"
      />
    );
  }
  if (user.role !== "SELLER") {
    return <Navigate replace to="/products" />;
  }
  if (ordersQuery.isPending) {
    return (
      <FullPageStatus
        description="Loading customer orders."
        icon={LoaderCircle}
        title="Loading orders"
      />
    );
  }
  if (ordersQuery.isError || !ordersQuery.data) {
    return (
      <FullPageStatus
        action={{
          label: "Try again",
          onClick: () => void ordersQuery.refetch(),
        }}
        description={getApiErrorMessage(
          ordersQuery.error,
          "Seller orders could not be loaded.",
        )}
        icon={AlertTriangle}
        title="Orders unavailable"
      />
    );
  }

  const { orders, pagination } = ordersQuery.data;

  function handleSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setCustomerSearch(searchInput.trim());
    setPage(1);
  }

  function openOrder(orderId: string): void {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set("orderId", orderId);
      return next;
    });
  }

  function closeOrder(): void {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("orderId");
      return next;
    });
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-sm font-semibold text-emerald-700">
            Seller workspace
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">
            Orders
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Review customer orders and manage fulfillment.
          </p>
        </div>
        <p className="text-sm text-zinc-600">
          {pagination.total.toLocaleString()} matching{" "}
          {pagination.total === 1 ? "order" : "orders"}
        </p>
      </div>

      <form
        className="mt-6 grid gap-3 border-y border-zinc-200 py-4 sm:grid-cols-[minmax(15rem,1fr)_13rem_auto]"
        onSubmit={handleSearch}
        role="search"
      >
        <label className="relative">
          <span className="sr-only">Search customers</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
          />
          <input
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white py-2 pl-10 pr-3 text-sm outline-none placeholder:text-zinc-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search customer name or email"
            type="search"
            value={searchInput}
          />
        </label>
        <label>
          <span className="sr-only">Filter by order status</span>
          <select
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
            onChange={(event) => {
              setStatus(
                event.target.value as SellerOrdersQuery["status"] | "",
              );
              setPage(1);
            }}
            value={status}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          type="submit"
        >
          <Search aria-hidden="true" className="size-4" />
          Search
        </button>
      </form>

      {orders.length === 0 ? (
        <section className="py-20 text-center">
          <PackageOpen
            aria-hidden="true"
            className="mx-auto size-8 text-zinc-400"
          />
          <h2 className="mt-4 text-lg font-semibold text-zinc-950">
            No matching orders
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Customer orders for your products will appear here.
          </p>
        </section>
      ) : (
        <>
          <div className="mt-6 hidden overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm xl:block">
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <colgroup>
                <col className="w-[8%]" />
                <col className="w-[15%]" />
                <col className="w-[9%]" />
                <col className="w-[17%]" />
                <col className="w-[7%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead className="bg-zinc-50">
                <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                  <th className="px-4 py-3 font-medium">Order ID</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Order date</th>
                  <th className="px-4 py-3 font-medium">Products ordered</th>
                  <th className="px-4 py-3 font-medium">Quantity</th>
                  <th className="px-4 py-3 font-medium">Total amount</th>
                  <th className="px-4 py-3 font-medium">Payment status</th>
                  <th className="px-4 py-3 font-medium">Order status</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {orders.map((order) => (
                  <SellerOrderTableRow
                    key={order.id}
                    onOpen={() => openOrder(order.id)}
                    order={order}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid gap-3 xl:hidden">
            {orders.map((order) => (
              <SellerOrderCard
                key={order.id}
                onOpen={() => openOrder(order.id)}
                order={order}
              />
            ))}
          </div>
        </>
      )}

      {pagination.totalPages > 1 ? (
        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="text-sm text-zinc-600">
            Page {pagination.page.toLocaleString()} of{" "}
            {pagination.totalPages.toLocaleString()}
          </p>
          <div className="flex gap-2">
            <button
              aria-label="Previous page"
              className="inline-flex size-10 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
              title="Previous page"
              type="button"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
            <button
              aria-label="Next page"
              className="inline-flex size-10 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((current) => current + 1)}
              title="Next page"
              type="button"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
      ) : null}

      {selectedOrderId ? (
        <SellerOrderDetailsDialog
          key={selectedOrderId}
          onClose={closeOrder}
          orderId={selectedOrderId}
        />
      ) : null}
    </main>
  );
}

function getInitialStatus(
  value: string | null,
): SellerOrdersQuery["status"] | "" {
  if (value === "PENDING_PAYMENT_VERIFICATION") {
    return value;
  }
  if (
    value === "PENDING" ||
    value === "CONFIRMED" ||
    value === "PROCESSING" ||
    value === "SHIPPED" ||
    value === "DELIVERED" ||
    value === "CANCELLED"
  ) {
    return value;
  }
  return "";
}

function SellerOrderTableRow({
  onOpen,
  order,
}: {
  onOpen: () => void;
  order: SellerOrder;
}) {
  return (
    <tr className="hover:bg-zinc-50">
      <td className="px-4 py-4 font-semibold text-zinc-950" title={order.id}>
        {formatOrderNumber(order.id)}
      </td>
      <td className="px-4 py-4">
        <p className="font-medium text-zinc-950">{order.customer.name}</p>
        <p className="mt-0.5 max-w-48 truncate text-xs text-zinc-500">
          {order.customer.email}
        </p>
      </td>
      <td className="px-4 py-4 text-zinc-600">
        {formatOrderDate(order.createdAt)}
      </td>
      <td className="px-4 py-4 text-zinc-700">
        <ProductNames order={order} />
      </td>
      <td className="px-4 py-4 font-semibold text-zinc-950">
        {order.totalItems.toLocaleString()}
      </td>
      <td className="px-4 py-4 font-semibold text-zinc-950">
        {formatProductPrice(order.sellerTotal)}
      </td>
      <td className="px-4 py-4">
        <SellerPaymentStatus order={order} />
      </td>
      <td className="px-4 py-4">
        <SellerWorkflowStatusBadge status={order.status} />
      </td>
      <td className="px-4 py-4 text-right">
        <button
          aria-label={`View order ${formatOrderNumber(order.id)}`}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100"
          onClick={onOpen}
          type="button"
        >
          <Eye aria-hidden="true" className="size-4" />
          View
        </button>
      </td>
    </tr>
  );
}

function SellerOrderCard({
  onOpen,
  order,
}: {
  onOpen: () => void;
  order: SellerOrder;
}) {
  return (
    <article className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-zinc-950">
            {formatOrderNumber(order.id)}
          </p>
          <p className="mt-1 truncate text-sm text-zinc-600">
            {order.customer.name}
          </p>
        </div>
        <SellerWorkflowStatusBadge status={order.status} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-zinc-200 py-4 text-sm">
        <MobileDetail
          label="Order date"
          value={formatOrderDate(order.createdAt)}
        />
        <MobileDetail
          label="Quantity"
          value={order.totalItems.toLocaleString()}
        />
        <div className="col-span-2">
          <dt className="text-xs font-medium uppercase text-zinc-500">
            Products
          </dt>
          <dd className="mt-1 text-sm font-medium text-zinc-950">
            <ProductNames order={order} />
          </dd>
        </div>
        <MobileDetail
          label="Total amount"
          value={formatProductPrice(order.sellerTotal)}
        />
        <div>
          <dt className="text-xs font-medium uppercase text-zinc-500">
            Payment
          </dt>
          <dd className="mt-1.5">
            <SellerPaymentStatus order={order} />
          </dd>
        </div>
      </dl>

      <button
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100"
        onClick={onOpen}
        type="button"
      >
        <Eye aria-hidden="true" className="size-4" />
        View order
      </button>
    </article>
  );
}

function ProductNames({ order }: { order: SellerOrder }) {
  const names = order.items.map((item) => item.product.name);
  const visibleNames = names.slice(0, 2).join(", ");
  const remaining = names.length - 2;

  return (
    <span>
      {visibleNames}
      {remaining > 0 ? ` +${remaining.toLocaleString()} more` : ""}
    </span>
  );
}

function SellerPaymentStatus({ order }: { order: SellerOrder }) {
  if (order.payment) {
    return <PaymentProofStatusBadge status={order.payment.status} />;
  }

  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
        order.paymentMethod === "CASH_ON_DELIVERY"
          ? "border-zinc-300 bg-zinc-100 text-zinc-700"
          : "border-amber-200 bg-amber-50 text-amber-800"
      }`}
    >
      {order.paymentMethod === "CASH_ON_DELIVERY"
        ? "Pay on delivery"
        : "Awaiting proof"}
    </span>
  );
}

function MobileDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-zinc-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-zinc-950">
        {value}
      </dd>
    </div>
  );
}
