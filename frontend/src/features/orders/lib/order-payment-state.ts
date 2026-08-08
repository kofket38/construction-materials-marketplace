import type { ManualPayment } from "@/features/checkout/api/payments.api";
import type { CustomerOrder } from "@/features/orders/model/order";

export type OrderPaymentState =
  | "PENDING_VERIFICATION"
  | "APPROVED"
  | "REJECTED"
  | "NOT_SUBMITTED"
  | "PAY_ON_DELIVERY";

export function getOrderPaymentState(
  order: CustomerOrder,
  payment?: ManualPayment | null,
): OrderPaymentState {
  if (order.paymentMethod === "CASH_ON_DELIVERY") {
    return "PAY_ON_DELIVERY";
  }

  if (payment?.status === "VERIFIED") {
    return "APPROVED";
  }
  if (
    payment?.status === "REJECTED" ||
    order.status === "PAYMENT_REJECTED"
  ) {
    return "REJECTED";
  }
  if (
    payment?.status === "PENDING_VERIFICATION" ||
    order.status === "PENDING_PAYMENT_VERIFICATION"
  ) {
    return "PENDING_VERIFICATION";
  }
  if (
    order.status !== "PENDING_PAYMENT" &&
    order.status !== "CANCELLED" &&
    order.status !== "REJECTED"
  ) {
    return "APPROVED";
  }

  return "NOT_SUBMITTED";
}
