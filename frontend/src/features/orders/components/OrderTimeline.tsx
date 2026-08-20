import { Check, Circle, X } from "lucide-react";

import type { CustomerOrder, OrderStatus } from "@/features/orders/model/order";

interface TimelineStep {
  label: string;
}

const manualPaymentSteps: TimelineStep[] = [
  { label: "Order Created" },
  { label: "Payment Submitted" },
  { label: "Payment Approved" },
  { label: "Seller Confirmed" },
  { label: "Preparing Order" },
  { label: "Ready for Pickup" },
  { label: "Out for Delivery" },
  { label: "Delivered" },
  { label: "Completed" },
];

const cashOnDeliverySteps: TimelineStep[] = [
  { label: "Order Created" },
  { label: "Seller Confirmed" },
  { label: "Preparing Order" },
  { label: "Ready for Pickup" },
  { label: "Out for Delivery" },
  { label: "Delivered" },
  { label: "Completed" },
];

export function OrderTimeline({ order }: { order: CustomerOrder }) {
  const isManualPayment = order.paymentMethod !== "CASH_ON_DELIVERY";
  const steps = isManualPayment ? manualPaymentSteps : cashOnDeliverySteps;
  const currentStep = getCurrentStep(order.status, isManualPayment);
  const terminalState = getTerminalState(order.status);

  return (
    <ol className="mt-5" aria-label="Order progress">
      {steps.map((step, index) => {
        const isCompleted =
          (terminalState !== null && index === 0) ||
          (terminalState === null &&
            (index < currentStep ||
              ((order.status === "DELIVERED" ||
                order.status === "COMPLETED") &&
                index === currentStep)));
        const isCurrent =
          terminalState === null && index === currentStep;
        const isLast = index === steps.length - 1;

        return (
          <li
            className="relative grid min-h-16 grid-cols-[2rem_minmax(0,1fr)] gap-3"
            key={step.label}
          >
            {!isLast ? (
              <span
                aria-hidden="true"
                className={`absolute left-[0.9375rem] top-7 h-[calc(100%-0.25rem)] w-0.5 ${
                  isCompleted ? "bg-emerald-600" : "bg-zinc-200"
                }`}
              />
            ) : null}
            <span
              aria-hidden="true"
              className={`relative z-10 flex size-8 items-center justify-center rounded-full border-2 ${
                isCompleted
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : isCurrent
                    ? "border-emerald-700 bg-emerald-50 text-emerald-700"
                    : "border-zinc-300 bg-white text-zinc-400"
              }`}
            >
              {isCompleted ? (
                <Check className="size-4" strokeWidth={2.5} />
              ) : (
                <Circle
                  className={isCurrent ? "size-3 fill-current" : "size-2"}
                />
              )}
            </span>
            <div className="min-w-0 pb-5 pt-1">
              <p
                className={`text-sm font-semibold ${
                  isCompleted || isCurrent
                    ? "text-zinc-950"
                    : "text-zinc-400"
                }`}
              >
                {step.label}
              </p>
              {isCurrent ? (
                <p className="mt-1 text-xs text-emerald-700">
                  Current step
                </p>
              ) : null}
            </div>
          </li>
        );
      })}

      {terminalState ? (
        <li className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-full border-2 border-red-600 bg-red-50 text-red-700"
          >
            <X className="size-4" strokeWidth={2.5} />
          </span>
          <div className="min-w-0 pt-1">
            <p className="text-sm font-semibold text-red-800">
              {terminalState}
            </p>
            <p className="mt-1 text-xs text-red-700">Current status</p>
          </div>
        </li>
      ) : null}
    </ol>
  );
}

function getCurrentStep(
  status: OrderStatus,
  isManualPayment: boolean,
): number {
  const offset = isManualPayment ? 2 : 0;

  switch (status) {
    case "PENDING_PAYMENT":
      return 1;
    case "PENDING_PAYMENT_VERIFICATION":
      return 1;
    case "PAYMENT_VERIFIED":
    case "PENDING_CONFIRMATION":
    case "PENDING":
      return 1 + offset;
    case "CONFIRMED":
    case "PROCESSING":
      return 2 + offset;
    case "READY_FOR_DELIVERY":
      return 3 + offset;
    case "OUT_FOR_DELIVERY":
    case "SHIPPED":
      return 4 + offset;
    case "DELIVERED":
      return 5 + offset;
    case "COMPLETED":
      return 6 + offset;
    case "PAYMENT_REJECTED":
    case "REJECTED":
    case "CANCELLED":
      return 0;
  }
}

function getTerminalState(status: OrderStatus): string | null {
  switch (status) {
    case "PAYMENT_REJECTED":
      return "Payment Rejected";
    case "REJECTED":
      return "Order Rejected";
    case "CANCELLED":
      return "Order Cancelled";
    default:
      return null;
  }
}
