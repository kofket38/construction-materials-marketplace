import type { OrderStatus } from "@/features/orders/model/order";
import type {
  SellerDashboardSummary,
  SellerOrder,
  SellerOrdersResult,
  SellerOrderStatusUpdate,
  SellerPaymentDecision,
} from "@/features/seller/model/seller-order";
import type { ApiSuccessResponse } from "@/shared/api/api.types";
import { apiClient } from "@/shared/api/http-client";

interface SellerDashboardData {
  dashboard: SellerDashboardSummary;
}

interface SellerOrderData {
  order: SellerOrder;
}

export interface SellerOrdersQuery {
  customerSearch?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  page: number;
  status?: Extract<
    OrderStatus,
    | "PENDING"
    | "PENDING_PAYMENT_VERIFICATION"
    | "CONFIRMED"
    | "PROCESSING"
    | "SHIPPED"
    | "DELIVERED"
    | "CANCELLED"
  >;
}

export async function getSellerDashboard(
  signal?: AbortSignal,
): Promise<SellerDashboardSummary> {
  const response = await apiClient.get<
    ApiSuccessResponse<SellerDashboardData>
  >("/seller/dashboard", { signal });

  return response.data.data.dashboard;
}

export async function getSellerOrders(
  input: SellerOrdersQuery,
  signal?: AbortSignal,
): Promise<SellerOrdersResult> {
  const response = await apiClient.get<
    ApiSuccessResponse<SellerOrdersResult>
  >("/seller/orders", {
    params: input,
    signal,
  });

  return response.data.data;
}

export async function getSellerOrderById(
  orderId: string,
  signal?: AbortSignal,
): Promise<SellerOrder> {
  const response = await apiClient.get<
    ApiSuccessResponse<SellerOrderData>
  >(`/seller/orders/${encodeURIComponent(orderId)}`, { signal });

  return response.data.data.order;
}

export async function verifySellerOrderPayment(
  orderId: string,
  decision: SellerPaymentDecision,
): Promise<SellerOrder> {
  const response = await apiClient.patch<
    ApiSuccessResponse<SellerOrderData>
  >(`/seller/orders/${encodeURIComponent(orderId)}/payment`, {
    decision,
  });

  return response.data.data.order;
}

export async function updateOrderStatus(
  orderId: string,
  status: SellerOrderStatusUpdate,
): Promise<SellerOrder> {
  const response = await apiClient.patch<
    ApiSuccessResponse<SellerOrderData>
  >(`/seller/orders/${encodeURIComponent(orderId)}/status`, { status });

  return response.data.data.order;
}
