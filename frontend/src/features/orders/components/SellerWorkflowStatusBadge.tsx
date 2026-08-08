import type { OrderStatus } from "@/features/orders/model/order";
import {
  formatSellerWorkflowStatus,
  getSellerWorkflowStatus,
} from "@/features/orders/lib/seller-order-workflow";

const statusClasses = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  CONFIRMED: "border-sky-200 bg-sky-50 text-sky-800",
  PROCESSING: "border-blue-200 bg-blue-50 text-blue-800",
  SHIPPED: "border-violet-200 bg-violet-50 text-violet-800",
  DELIVERED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  CANCELLED: "border-zinc-300 bg-zinc-100 text-zinc-700",
} as const;

export function SellerWorkflowStatusBadge({
  status,
}: {
  status: OrderStatus;
}) {
  const workflowStatus = getSellerWorkflowStatus(status);

  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses[workflowStatus]}`}
      data-seller-order-status={workflowStatus}
    >
      {formatSellerWorkflowStatus(status)}
    </span>
  );
}
