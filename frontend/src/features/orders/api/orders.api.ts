import type { ApiSuccessResponse } from "@/shared/api/api.types";
import { apiClient } from "@/shared/api/http-client";
import type { CustomerOrder } from "@/features/orders/model/order";

interface OrderDetailsData {
  order: CustomerOrder;
}

interface MyOrdersData {
  orders: CustomerOrder[];
}

export async function getOrder(
  orderId: string,
  signal?: AbortSignal,
): Promise<CustomerOrder> {
  const response = await apiClient.get<
    ApiSuccessResponse<OrderDetailsData>
  >(`/orders/${encodeURIComponent(orderId)}`, { signal });

  return response.data.data.order;
}

export async function getMyOrders(
  signal?: AbortSignal,
): Promise<CustomerOrder[]> {
  const response = await apiClient.get<ApiSuccessResponse<MyOrdersData>>(
    "/orders",
    { signal },
  );

  return response.data.data.orders;
}

export async function completeOrder(
  orderId: string,
): Promise<CustomerOrder> {
  const response = await apiClient.post<
    ApiSuccessResponse<OrderDetailsData>
  >(`/orders/${encodeURIComponent(orderId)}/complete`, {});

  return response.data.data.order;
}
