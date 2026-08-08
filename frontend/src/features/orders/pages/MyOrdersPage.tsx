import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import type { ManualPayment } from "@/features/checkout/api/payments.api";
import { getMyOrders } from "@/features/orders/api/orders.api";
import { MyOrdersPageSkeleton } from "@/features/orders/components/OrderPageSkeletons";
import { OrderPaymentStatusBadge } from "@/features/orders/components/OrderPaymentStatusBadge";
import { OrderStatusBadge } from "@/features/orders/components/OrderStatusBadge";
import { useOrderPayments } from "@/features/orders/hooks/use-order-payments";
import { useOrderSellerNames } from "@/features/orders/hooks/use-order-seller-names";
import {
  formatOrderDate,
  formatOrderNumber,
  formatPaymentMethod,
  getOrderSellerIds,
} from "@/features/orders/lib/order-display";
import { getOrderPaymentState } from "@/features/orders/lib/order-payment-state";
import type { CustomerOrder } from "@/features/orders/model/order";
import { formatProductPrice } from "@/features/products/lib/product-display";
import { getApiErrorMessage } from "@/shared/api/http-error";
import { FullPageStatus } from "@/shared/ui/FullPageStatus";

const ORDER_REFRESH_INTERVAL = 30_000;

export function MyOrdersPage() {
  const queryClient = useQueryClient();
  const ordersQuery = useQuery({
    queryKey: ["orders", "mine"],
    queryFn: ({ signal }) => getMyOrders(signal),
    refetchInterval: ORDER_REFRESH_INTERVAL,
  });
  const orders = useMemo(
    () =>
      [...(ordersQuery.data ?? [])].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      ),
    [ordersQuery.data],
  );
  const sellerNames = useOrderSellerNames(orders);
  const paymentStates = useOrderPayments(orders);

  if (ordersQuery.isPending) {
    return <MyOrdersPageSkeleton />;
  }
  if (ordersQuery.isError) {
    return (
      <FullPageStatus
        action={{
          label: "Try again",
          onClick: () => void ordersQuery.refetch(),
        }}
        description={getApiErrorMessage(
          ordersQuery.error,
          "Your orders could not be loaded.",
        )}
        icon={AlertTriangle}
        title="Orders unavailable"
      />
    );
  }

  async function handleRefresh(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({
        exact: true,
        queryKey: ["orders", "mine"],
        refetchType: "active",
      }),
      queryClient.invalidateQueries({
        queryKey: ["payments", "manual"],
        refetchType: "active",
      }),
    ]);
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-sm font-semibold text-emerald-700">
            Account
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">
            My Orders
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Review past purchases and track active deliveries.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden min-h-10 items-center gap-2 text-sm text-zinc-600 sm:flex">
            <ReceiptText aria-hidden="true" className="size-4" />
            {orders.length.toLocaleString()}{" "}
            {orders.length === 1 ? "order" : "orders"}
          </div>
          <button
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-wait disabled:opacity-60"
            disabled={ordersQuery.isFetching}
            onClick={() => void handleRefresh()}
            type="button"
          >
            <RefreshCw
              aria-hidden="true"
              className={`size-4 ${
                ordersQuery.isFetching ? "animate-spin" : ""
              }`}
            />
            Refresh
          </button>
        </div>
      </div>

      {orders.length === 0 ? (
        <OrdersEmptyState />
      ) : (
        <div className="mt-6 space-y-3">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              payment={paymentStates.get(order.id)?.payment}
              paymentIsPending={
                paymentStates.get(order.id)?.isPending ?? false
              }
              sellerNames={sellerNames}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function OrderCard({
  order,
  payment,
  paymentIsPending,
  sellerNames,
}: {
  order: CustomerOrder;
  payment: ManualPayment | null | undefined;
  paymentIsPending: boolean;
  sellerNames: Map<string, string>;
}) {
  const sellerLabel = getSellerLabel(order, sellerNames);
  const productCount = order.items.length;

  return (
    <Link
      className="group block rounded-md border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:p-5"
      to={`/orders/${encodeURIComponent(order.id)}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase text-zinc-500">
            Order number
          </p>
          <h2
            className="mt-1 text-base font-semibold text-zinc-950"
            title={order.id}
          >
            {formatOrderNumber(order.id)}
          </h2>
        </div>
        <ArrowRight
          aria-hidden="true"
          className="mt-1 size-5 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-700"
        />
      </div>

      <dl className="mt-5 grid gap-x-5 gap-y-4 border-y border-zinc-200 py-4 sm:grid-cols-2 lg:grid-cols-4">
        <OrderCardDetail
          label="Order date"
          value={formatOrderDate(order.createdAt)}
        />
        <OrderCardDetail label="Seller" value={sellerLabel} />
        <OrderCardDetail
          label="Products"
          value={`${productCount.toLocaleString()} ${
            productCount === 1 ? "product" : "products"
          }`}
        />
        <OrderCardDetail
          label="Total price"
          value={formatProductPrice(order.totalAmount)}
        />
      </dl>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase text-zinc-500">
            Payment method
          </p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">
            {formatPaymentMethod(order.paymentMethod)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-zinc-500">
            Payment status
          </p>
          <div className="mt-1">
            {paymentIsPending ? (
              <span
                aria-label="Loading payment status"
                className="block h-7 w-32 animate-pulse rounded-full bg-zinc-200"
              />
            ) : (
              <OrderPaymentStatusBadge
                state={getOrderPaymentState(order, payment)}
              />
            )}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-zinc-500">
            Order status
          </p>
          <div className="mt-1">
            <OrderStatusBadge status={order.status} />
          </div>
        </div>
      </div>
    </Link>
  );
}

function OrderCardDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase text-zinc-500">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold text-zinc-950">
        {value}
      </dd>
    </div>
  );
}

function OrdersEmptyState() {
  return (
    <section className="py-14 text-center sm:py-20">
      <div
        aria-label="Empty delivery pallet"
        className="relative mx-auto h-32 w-48"
        role="img"
      >
        <span className="absolute bottom-3 left-3 right-3 h-3 rounded-sm bg-zinc-300" />
        <span className="absolute bottom-0 left-7 right-7 h-3 border-x-4 border-zinc-300" />
        <span className="absolute bottom-7 left-5 flex size-20 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm">
          <Boxes aria-hidden="true" className="size-9" />
        </span>
        <span className="absolute bottom-7 right-5 flex size-16 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 shadow-sm">
          <PackageCheck aria-hidden="true" className="size-7" />
        </span>
      </div>
      <h2 className="mt-5 text-xl font-semibold text-zinc-950">
        You haven&apos;t placed any orders yet.
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-600">
        Your completed purchases and delivery progress will appear here.
      </p>
      <Link
        className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        to="/products"
      >
        <ShoppingBag aria-hidden="true" className="size-4" />
        Browse Products
      </Link>
    </section>
  );
}

function getSellerLabel(
  order: CustomerOrder,
  sellerNames: Map<string, string>,
): string {
  const labels = getOrderSellerIds(order).map(
    (sellerId) =>
      sellerNames.get(sellerId) ??
      `Seller ${sellerId.slice(0, 8).toUpperCase()}`,
  );

  return labels.join(", ");
}
