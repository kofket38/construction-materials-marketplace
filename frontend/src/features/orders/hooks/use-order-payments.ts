import { useQueries } from "@tanstack/react-query";

import {
  getManualPayment,
  type ManualPayment,
} from "@/features/checkout/api/payments.api";
import { isManualPaymentOrder } from "@/features/orders/lib/order-display";
import type { CustomerOrder } from "@/features/orders/model/order";

export interface OrderPaymentQueryState {
  isError: boolean;
  isPending: boolean;
  payment: ManualPayment | null | undefined;
  refetch: () => void;
}

export function useOrderPayments(
  orders: CustomerOrder[],
): Map<string, OrderPaymentQueryState> {
  const manualOrders = orders.filter(isManualPaymentOrder);
  const paymentQueries = useQueries({
    queries: manualOrders.map((order) => ({
      queryKey: ["payments", "manual", order.id],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getManualPayment(order.id, signal),
      refetchInterval: 30_000,
    })),
  });
  const paymentStates = new Map<string, OrderPaymentQueryState>();

  manualOrders.forEach((order, index) => {
    const query = paymentQueries[index];
    if (query) {
      paymentStates.set(order.id, {
        isError: query.isError,
        isPending: query.isPending,
        payment: query.data?.payment,
        refetch: () => void query.refetch(),
      });
    }
  });

  return paymentStates;
}
