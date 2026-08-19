import type { OrderStatus } from "@/features/orders/model/order";
import type { SellerOrderStatusUpdate } from "@/features/seller/model/seller-order";

const nextStatusByCurrent: Partial<
  Record<OrderStatus, SellerOrderStatusUpdate>
> = {
  PENDING_CONFIRMATION: "CONFIRMED",
  PENDING: "CONFIRMED",
  CONFIRMED: "PROCESSING",
  PAYMENT_VERIFIED: "CONFIRMED",
  PROCESSING: "READY_FOR_DELIVERY",
  READY_FOR_DELIVERY: "SHIPPED",
  OUT_FOR_DELIVERY: "DELIVERED",
  SHIPPED: "DELIVERED",
};

const actionLabels: Record<SellerOrderStatusUpdate, string> = {
  CONFIRMED: "Confirm order",
  PROCESSING: "Mark processing",
  READY_FOR_DELIVERY: "Mark ready for delivery",
  SHIPPED: "Mark shipped",
  DELIVERED: "Mark delivered",
  CANCELLED: "Cancel order",
};

export function getNextSellerOrderStatus(
  status: OrderStatus,
): SellerOrderStatusUpdate | null {
  return nextStatusByCurrent[status] ?? null;
}

export function getSellerOrderActionLabel(
  status: SellerOrderStatusUpdate,
): string {
  return actionLabels[status];
}
