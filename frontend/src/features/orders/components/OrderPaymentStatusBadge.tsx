import type { OrderPaymentState } from "@/features/orders/lib/order-payment-state";

const paymentStateDisplay: Record<
  OrderPaymentState,
  { className: string; label: string }
> = {
  PENDING_VERIFICATION: {
    className: "border-amber-200 bg-amber-50 text-amber-800",
    label: "Pending verification",
  },
  APPROVED: {
    className: "border-success-line bg-success-soft text-success",
    label: "Approved",
  },
  REJECTED: {
    className: "border-red-200 bg-red-50 text-red-800",
    label: "Rejected",
  },
  NOT_SUBMITTED: {
    className: "border-amber-200 bg-amber-50 text-amber-800",
    label: "Not submitted",
  },
  PAY_ON_DELIVERY: {
    className: "border-sky-200 bg-sky-50 text-sky-800",
    label: "Pay on delivery",
  },
};

export function OrderPaymentStatusBadge({
  state,
}: {
  state: OrderPaymentState;
}) {
  const display = paymentStateDisplay[state];

  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${display.className}`}
      data-payment-status={state}
    >
      {display.label}
    </span>
  );
}
