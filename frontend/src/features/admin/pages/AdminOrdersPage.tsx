import {
  AlertTriangle,
  LoaderCircle,
  PackageOpen,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import {
  getAdminOrders,
  updateAdminOrderStatus,
  type AdminOrder,
  type AdminOrderStatus,
  type AdminOrdersQuery,
  type AdminPaymentStatus,
} from "@/features/admin/api/admin.api";
import { AdminPaginationBar } from "@/features/admin/components/AdminPagination";
import { formatAdminDate, formatAdminDateTime } from "@/features/admin/lib/admin-display";
import { formatProductPrice } from "@/features/products/lib/product-display";
import { formatOrderNumber } from "@/features/orders/lib/order-display";
import { OrderStatusBadge } from "@/features/orders/components/OrderStatusBadge";
import { getApiErrorMessage } from "@/shared/api/http-error";
import { useProofObjectUrl } from "@/features/payments/hooks/use-proof-object-url";
import { AuthenticatedProofImage } from "@/features/payments/components/AuthenticatedProofImage";

const PAGE_SIZE = 20;

const ORDER_STATUS_OPTIONS: Array<{ label: string; value: AdminOrderStatus | "" }> = [
  { label: "All statuses", value: "" },
  { label: "Pending payment", value: "PENDING_PAYMENT" },
  { label: "Awaiting verification", value: "PENDING_PAYMENT_VERIFICATION" },
  { label: "Pending confirmation", value: "PENDING_CONFIRMATION" },
  { label: "Pending (RFQ)", value: "PENDING" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "Processing", value: "PROCESSING" },
  { label: "Ready for delivery", value: "READY_FOR_DELIVERY" },
  { label: "Shipped", value: "SHIPPED" },
  { label: "Delivered", value: "DELIVERED" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

const PAYMENT_STATUS_OPTIONS: Array<{ label: string; value: AdminPaymentStatus | "" }> = [
  { label: "All payments", value: "" },
  { label: "Pending verification", value: "PENDING_VERIFICATION" },
  { label: "Verified", value: "VERIFIED" },
  { label: "Rejected", value: "REJECTED" },
];

// Valid next statuses an admin can force-set (respects terminal states)
const ADMIN_NEXT_STATUSES: Partial<Record<AdminOrderStatus, AdminOrderStatus[]>> = {
  PENDING_PAYMENT: ["CANCELLED"],
  PENDING_PAYMENT_VERIFICATION: ["CONFIRMED", "PAYMENT_REJECTED", "CANCELLED"],
  PENDING_CONFIRMATION: ["CONFIRMED", "CANCELLED"],
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["READY_FOR_DELIVERY", "CANCELLED"],
  READY_FOR_DELIVERY: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["COMPLETED"],
};

export function AdminOrdersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AdminOrderStatus | "">("");
  const [paymentStatus, setPaymentStatus] = useState<AdminPaymentStatus | "">("");
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);

  const query: AdminOrdersQuery = {
    page,
    limit: PAGE_SIZE,
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
  };

  const ordersQuery = useQuery({
    queryKey: ["admin", "orders", query],
    queryFn: ({ signal }) => getAdminOrders(query, signal),
    placeholderData: keepPreviousData,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status: s }: { id: string; status: AdminOrderStatus }) =>
      updateAdminOrderStatus(id, s),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      // Refresh the detail panel
      if (selectedOrder) {
        void queryClient.invalidateQueries({
          queryKey: ["admin", "orders", query],
        });
      }
      setSelectedOrder(null);
    },
  });

  function handleSearch(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  function handleFilterChange(
    s: AdminOrderStatus | "",
    ps: AdminPaymentStatus | "",
  ): void {
    setStatus(s);
    setPaymentStatus(ps);
    setPage(1);
  }

  const { orders = [], pagination } = ordersQuery.data ?? {};

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Administration</p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Orders</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Inspect and manage all marketplace orders.
          </p>
        </div>
        {pagination ? (
          <p className="text-sm text-zinc-600">
            {pagination.total.toLocaleString()} order{pagination.total !== 1 ? "s" : ""}
          </p>
        ) : null}
      </div>

      {/* Filters */}
      <form
        className="mt-5 grid gap-3 border-b border-zinc-200 pb-4 sm:grid-cols-[minmax(12rem,1fr)_11rem_11rem_auto]"
        onSubmit={handleSearch}
        role="search"
      >
        <label className="relative">
          <span className="sr-only">Search orders</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
          />
          <input
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white py-2 pl-10 pr-3 text-sm outline-none placeholder:text-zinc-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Customer name or email"
            type="search"
            value={searchInput}
          />
        </label>
        <label>
          <span className="sr-only">Filter by order status</span>
          <select
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
            onChange={(e) =>
              handleFilterChange(e.target.value as AdminOrderStatus | "", paymentStatus)
            }
            value={status}
          >
            {ORDER_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by payment status</span>
          <select
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
            onChange={(e) =>
              handleFilterChange(status, e.target.value as AdminPaymentStatus | "")
            }
            value={paymentStatus}
          >
            {PAYMENT_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
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

      {/* Table */}
      {ordersQuery.isPending ? (
        <div className="flex min-h-64 items-center justify-center">
          <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-emerald-700" />
        </div>
      ) : ordersQuery.isError ? (
        <div className="mt-6 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {getApiErrorMessage(ordersQuery.error, "Orders could not be loaded.")}
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-8 py-16 text-center">
          <ShoppingBag aria-hidden="true" className="mx-auto size-8 text-zinc-400" />
          <p className="mt-4 font-semibold text-zinc-950">No orders found</p>
          <p className="mt-1 text-sm text-zinc-500">Try a different search or filter.</p>
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
              <thead className="bg-zinc-50">
                <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Payment</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {orders.map((order) => (
                  <tr className="hover:bg-zinc-50" key={order.id}>
                    <td className="px-4 py-4 font-mono text-xs font-semibold text-zinc-950" title={order.id}>
                      {formatOrderNumber(order.id)}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-zinc-950">{order.customer.name}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">{order.customer.email}</p>
                    </td>
                    <td className="px-4 py-4 text-zinc-700">
                      {order.itemCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 font-semibold text-zinc-950">
                      {formatProductPrice(order.totalAmount)}
                    </td>
                    <td className="px-4 py-4">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-4">
                      {order.payment ? (
                        <PaymentStatusPill status={order.payment.status} />
                      ) : order.paymentMethod === "CASH_ON_DELIVERY" ? (
                        <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600">
                          COD
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                          Awaiting proof
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-zinc-600">
                      {formatAdminDate(order.createdAt)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                        onClick={() => setSelectedOrder(order)}
                        type="button"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination ? (
            <AdminPaginationBar onPageChange={setPage} pagination={pagination} />
          ) : null}
        </div>
      )}

      {/* Detail panel */}
      {selectedOrder ? (
        <OrderDetailPanel
          isUpdating={statusMutation.isPending}
          onClose={() => {
            setSelectedOrder(null);
            statusMutation.reset();
          }}
          onUpdateStatus={(s) =>
            statusMutation.mutate({ id: selectedOrder.id, status: s })
          }
          order={selectedOrder}
          updateError={
            statusMutation.isError
              ? getApiErrorMessage(statusMutation.error, "Status could not be updated.")
              : null
          }
        />
      ) : null}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PaymentStatusPill({ status }: { status: string }) {
  const classes: Record<string, string> = {
    PENDING_VERIFICATION: "border-amber-200 bg-amber-50 text-amber-700",
    VERIFIED: "border-emerald-200 bg-emerald-50 text-emerald-700",
    REJECTED: "border-red-200 bg-red-50 text-red-700",
  };
  const labels: Record<string, string> = {
    PENDING_VERIFICATION: "Pending",
    VERIFIED: "Verified",
    REJECTED: "Rejected",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${classes[status] ?? "border-zinc-200 bg-zinc-50 text-zinc-600"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function OrderDetailPanel({
  isUpdating,
  onClose,
  onUpdateStatus,
  order,
  updateError,
}: {
  isUpdating: boolean;
  onClose: () => void;
  onUpdateStatus: (status: AdminOrderStatus) => void;
  order: AdminOrder;
  updateError: string | null;
}) {
  const nextStatuses = ADMIN_NEXT_STATUSES[order.status] ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-zinc-950/40"
      onMouseDown={(e) => {
        if (e.currentTarget === e.target && !isUpdating) onClose();
      }}
    >
      <aside className="flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-emerald-700">Order detail</p>
            <h2 className="mt-0.5 font-mono text-base font-semibold text-zinc-950">
              {formatOrderNumber(order.id)}
            </h2>
          </div>
          <button
            aria-label="Close"
            className="inline-flex size-9 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100"
            disabled={isUpdating}
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 p-5">
          {/* Status + Update */}
          <section>
            <h3 className="text-sm font-semibold text-zinc-950">Order Status</h3>
            <div className="mt-2 flex items-center gap-3">
              <OrderStatusBadge status={order.status} />
              <span className="text-xs text-zinc-500">
                Updated {formatAdminDateTime(order.updatedAt)}
              </span>
            </div>

            {nextStatuses.length > 0 ? (
              <div className="mt-3">
                <p className="text-xs font-medium text-zinc-600">
                  Force-advance status:
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {nextStatuses.map((s) => (
                    <button
                      className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
                      disabled={isUpdating}
                      key={s}
                      onClick={() => onUpdateStatus(s)}
                      type="button"
                    >
                      {isUpdating ? (
                        <LoaderCircle aria-hidden="true" className="size-3 animate-spin" />
                      ) : null}
                      → {s.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">
                No further transitions available (terminal status).
              </p>
            )}

            {updateError ? (
              <p className="mt-2 text-xs text-red-700" role="alert">
                {updateError}
              </p>
            ) : null}
          </section>

          {/* Customer */}
          <section>
            <h3 className="text-sm font-semibold text-zinc-950">Customer</h3>
            <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">Name</dt>
                <dd className="font-medium text-zinc-950">{order.customer.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Email</dt>
                <dd className="break-all font-medium text-zinc-950">{order.customer.email}</dd>
              </div>
            </dl>
          </section>

          {/* Delivery */}
          <section>
            <h3 className="text-sm font-semibold text-zinc-950">Delivery</h3>
            <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">Recipient</dt>
                <dd className="font-medium text-zinc-950">{order.shippingFullName}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Phone</dt>
                <dd className="font-medium text-zinc-950">{order.shippingPhone}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">City</dt>
                <dd className="font-medium text-zinc-950">{order.shippingCity}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Address</dt>
                <dd className="font-medium text-zinc-950">{order.shippingAddress}</dd>
              </div>
              {order.shippingNotes ? (
                <div className="col-span-2">
                  <dt className="text-xs text-zinc-500">Notes</dt>
                  <dd className="font-medium text-zinc-950">{order.shippingNotes}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          {/* Payment */}
          <section>
            <h3 className="text-sm font-semibold text-zinc-950">Payment</h3>
            <div className="mt-2 text-sm">
              <p>
                <span className="text-zinc-500">Method: </span>
                <span className="font-medium text-zinc-950">
                  {order.paymentMethod.replace(/_/g, " ")}
                </span>
              </p>
              {order.payment ? (
                <>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-zinc-500">Proof: </span>
                    <PaymentStatusPill status={order.payment.status} />
                  </div>
                  {order.payment.proofImageUrl ? (
                    <AdminProofBlock filename={order.payment.proofImageUrl} />
                  ) : null}
                </>
              ) : null}
            </div>
          </section>

          {/* Items */}
          <section>
            <h3 className="text-sm font-semibold text-zinc-950">
              Items ({order.itemCount})
            </h3>
            <div className="mt-2 divide-y divide-zinc-200 rounded-md border border-zinc-200">
              {order.items.map((item) => (
                <div className="flex items-start gap-3 p-3" key={item.id}>
                  <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 text-zinc-400">
                    {item.productImageUrl ? (
                      <img alt="" className="size-full object-cover" src={item.productImageUrl} />
                    ) : (
                      <PackageOpen aria-hidden="true" className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-zinc-950 line-clamp-1">
                      {item.productName}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {item.quantity.toLocaleString()} × {formatProductPrice(item.unitPrice)}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold text-zinc-950">
                    {formatProductPrice(item.subtotal)}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-end text-sm">
              <p>
                <span className="text-zinc-500">Total: </span>
                <span className="font-semibold text-zinc-950">
                  {formatProductPrice(order.totalAmount)}
                </span>
              </p>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function AdminProofBlock({ filename }: { filename: string }) {
  const { objectUrl } = useProofObjectUrl(filename);

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100">
      <AuthenticatedProofImage
        alt="Payment proof"
        className="aspect-video w-full object-contain"
        filename={filename}
      />
      {objectUrl ? (
        <div className="border-t border-zinc-200 px-3 py-2">
          <a
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            download={filename}
            href={objectUrl}
          >
            Open proof
          </a>
        </div>
      ) : null}
    </div>
  );
}
