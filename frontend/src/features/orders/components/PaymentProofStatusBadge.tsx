import type { PaymentProofStatus } from "@/features/orders/model/order";
import { formatPaymentProofStatus } from "@/features/orders/lib/order-display";

const statusClasses: Record<PaymentProofStatus, string> = {
  PENDING_VERIFICATION: "border-amber-200 bg-amber-50 text-amber-800",
  VERIFIED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  REJECTED: "border-red-200 bg-red-50 text-red-800",
};

export function PaymentProofStatusBadge({
  status,
}: {
  status: PaymentProofStatus;
}) {
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses[status]}`}
      data-payment-proof-status={status}
    >
      {formatPaymentProofStatus(status)}
    </span>
  );
}
