import type { OrderStatus } from "@/features/orders/model/order";
import type { SellerOrderStatusUpdate } from "@/features/seller/model/seller-order";
import { resolveApiAssetUrl } from "@/shared/api/resolve-api-asset-url";

const nextStatusByCurrent: Partial<
  Record<OrderStatus, SellerOrderStatusUpdate>
> = {
  PENDING_CONFIRMATION: "CONFIRMED",
  PENDING: "CONFIRMED",
  CONFIRMED: "PROCESSING",
  PAYMENT_VERIFIED: "CONFIRMED",
  PROCESSING: "SHIPPED",
  READY_FOR_DELIVERY: "SHIPPED",
  OUT_FOR_DELIVERY: "DELIVERED",
  SHIPPED: "DELIVERED",
};

const actionLabels: Record<SellerOrderStatusUpdate, string> = {
  CONFIRMED: "Confirm order",
  PROCESSING: "Mark processing",
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

export function resolvePaymentProofUrl(path: string): string {
  return resolveApiAssetUrl(path);
}
