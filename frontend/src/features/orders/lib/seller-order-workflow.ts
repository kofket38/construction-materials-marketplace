import type { OrderStatus } from "@/features/orders/model/order";
import type { SellerOrderStatusUpdate } from "@/features/seller/model/seller-order";

export type SellerWorkflowStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED";

const workflowLabels: Record<SellerWorkflowStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function getSellerWorkflowStatus(
  status: OrderStatus,
): SellerWorkflowStatus {
  switch (status) {
    case "PENDING_PAYMENT":
    case "PENDING_PAYMENT_VERIFICATION":
    case "PENDING_CONFIRMATION":
    case "PENDING":
      return "PENDING";
    case "PAYMENT_VERIFIED":
    case "CONFIRMED":
      return "CONFIRMED";
    case "PROCESSING":
    case "READY_FOR_DELIVERY":
      return "PROCESSING";
    case "OUT_FOR_DELIVERY":
    case "SHIPPED":
      return "SHIPPED";
    case "DELIVERED":
      return "DELIVERED";
    case "COMPLETED":
      return "COMPLETED";
    case "PAYMENT_REJECTED":
    case "REJECTED":
    case "CANCELLED":
      return "CANCELLED";
  }
}

export function formatSellerWorkflowStatus(
  status: OrderStatus,
): string {
  return workflowLabels[getSellerWorkflowStatus(status)];
}

export function getSellerPrimaryOrderAction(
  status: OrderStatus,
): { label: string; status: SellerOrderStatusUpdate } | null {
  switch (status) {
    case "PENDING_CONFIRMATION":
    case "PENDING":
    case "PAYMENT_VERIFIED":
      return { label: "Confirm order", status: "CONFIRMED" };
    case "CONFIRMED":
      return { label: "Mark processing", status: "PROCESSING" };
    case "PROCESSING":
      return {
        label: "Mark ready for delivery",
        status: "READY_FOR_DELIVERY",
      };
    case "READY_FOR_DELIVERY":
      return { label: "Mark shipped", status: "SHIPPED" };
    case "OUT_FOR_DELIVERY":
    case "SHIPPED":
      return { label: "Mark delivered", status: "DELIVERED" };
    default:
      return null;
  }
}

export function canSellerCancelOrder(status: OrderStatus): boolean {
  return [
    "PENDING_PAYMENT",
    "PENDING_CONFIRMATION",
    "PENDING",
    "PAYMENT_VERIFIED",
    "CONFIRMED",
    "PROCESSING",
    "READY_FOR_DELIVERY",
  ].includes(status);
}
