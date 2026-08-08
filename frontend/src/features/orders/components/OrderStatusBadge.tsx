import type { OrderStatus } from "@/features/orders/model/order";
import { formatOrderStatus } from "@/features/orders/lib/order-display";

const statusClasses: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "border-amber-200 bg-amber-50 text-amber-800",
  PENDING_PAYMENT_VERIFICATION:
    "border-amber-200 bg-amber-50 text-amber-800",
  PAYMENT_VERIFIED: "border-sky-200 bg-sky-50 text-sky-800",
  PAYMENT_REJECTED: "border-red-200 bg-red-50 text-red-800",
  PENDING_CONFIRMATION: "border-amber-200 bg-amber-50 text-amber-800",
  PROCESSING: "border-sky-200 bg-sky-50 text-sky-800",
  READY_FOR_DELIVERY: "border-indigo-200 bg-indigo-50 text-indigo-800",
  OUT_FOR_DELIVERY: "border-violet-200 bg-violet-50 text-violet-800",
  DELIVERED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  REJECTED: "border-red-200 bg-red-50 text-red-800",
  CANCELLED: "border-zinc-300 bg-zinc-100 text-zinc-700",
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  CONFIRMED: "border-sky-200 bg-sky-50 text-sky-800",
  SHIPPED: "border-violet-200 bg-violet-50 text-violet-800",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses[status]}`}
      data-order-status={status}
    >
      {formatOrderStatus(status)}
    </span>
  );
}
