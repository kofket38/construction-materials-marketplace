import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Box,
  Building2,
  CalendarDays,
  Clock3,
  ExternalLink,
  FileImage,
  Hash,
  MapPin,
  PackageOpen,
  ReceiptText,
  RefreshCw,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";

import {
  getManualPayment,
  type ManualPayment,
} from "@/features/checkout/api/payments.api";
import { getOrder } from "@/features/orders/api/orders.api";
import { OrderDetailsPageSkeleton } from "@/features/orders/components/OrderPageSkeletons";
import { OrderPaymentStatusBadge } from "@/features/orders/components/OrderPaymentStatusBadge";
import { OrderStatusBadge } from "@/features/orders/components/OrderStatusBadge";
import { OrderTimeline } from "@/features/orders/components/OrderTimeline";
import { useOrderSellerNames } from "@/features/orders/hooks/use-order-seller-names";
import {
  formatOrderDateTime,
  formatOrderNumber,
  formatPaymentMethod,
  getOrderSellerIds,
  isManualPaymentOrder,
} from "@/features/orders/lib/order-display";
import { getOrderPaymentState } from "@/features/orders/lib/order-payment-state";
import type {
  CustomerOrder,
  CustomerOrderItem,
} from "@/features/orders/model/order";
import { formatProductPrice } from "@/features/products/lib/product-display";
import { getApiErrorMessage } from "@/shared/api/http-error";
import { resolveApiAssetUrl } from "@/shared/api/resolve-api-asset-url";
import { FullPageStatus } from "@/shared/ui/FullPageStatus";

const ORDER_REFRESH_INTERVAL = 30_000;

export function OrderDetailsPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const queryClient = useQueryClient();
  const orderQuery = useQuery({
    queryKey: ["orders", "details", orderId],
    enabled: Boolean(orderId),
    queryFn: ({ signal }) => {
      if (!orderId) {
        throw new Error("An order ID is required.");
      }
      return getOrder(orderId, signal);
    },
    refetchInterval: ORDER_REFRESH_INTERVAL,
  });
  const order = orderQuery.data;
  const sellerNames = useOrderSellerNames(order ? [order] : []);
  const paymentQuery = useQuery({
    queryKey: ["payments", "manual", orderId],
    enabled: Boolean(orderId && order && isManualPaymentOrder(order)),
    queryFn: ({ signal }) => {
      if (!orderId) {
        throw new Error("An order ID is required.");
      }
      return getManualPayment(orderId, signal);
    },
    refetchInterval: ORDER_REFRESH_INTERVAL,
  });

  if (!orderId) {
    return <Navigate replace to="/orders" />;
  }
  if (orderQuery.isPending) {
    return <OrderDetailsPageSkeleton />;
  }
  if (orderQuery.isError || !order) {
    return (
      <FullPageStatus
        action={{
          label: "Try again",
          onClick: () => void orderQuery.refetch(),
        }}
        description={getApiErrorMessage(
          orderQuery.error,
          "This order could not be loaded.",
        )}
        icon={AlertTriangle}
        title="Order unavailable"
      />
    );
  }

  const sellerLabels = getOrderSellerIds(order).map(
    (sellerId) =>
      sellerNames.get(sellerId) ??
      `Seller ${sellerId.slice(0, 8).toUpperCase()}`,
  );
  const payment = paymentQuery.data?.payment;
  const isRefreshing = orderQuery.isFetching || paymentQuery.isFetching;

  async function handleRefresh(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({
        exact: true,
        queryKey: ["orders", "details", orderId],
        refetchType: "active",
      }),
      queryClient.invalidateQueries({
        exact: true,
        queryKey: ["payments", "manual", orderId],
        refetchType: "active",
      }),
    ]);
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <Link
          className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-zinc-600 transition-colors hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
          to="/orders"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          My Orders
        </Link>
        <button
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-wait disabled:opacity-60"
          disabled={isRefreshing}
          onClick={() => void handleRefresh()}
          type="button"
        >
          <RefreshCw
            aria-hidden="true"
            className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-6">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-700">
            Order tracking
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">
            Order {formatOrderNumber(order.id)}
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Placed {formatOrderDateTime(order.createdAt)}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-10">
          <OrderSection icon={Box} title="Ordered Products">
            <div className="mt-4 divide-y divide-zinc-200 border-y border-zinc-200">
              {order.items.map((item) => (
                <OrderItemRow item={item} key={item.id} />
              ))}
            </div>
          </OrderSection>

          <OrderSection icon={MapPin} title="Delivery Information">
            <dl className="mt-4 grid gap-x-8 gap-y-5 border-y border-zinc-200 py-5 sm:grid-cols-2">
              <Detail
                label="Recipient Name"
                value={order.shippingFullName}
              />
              <Detail
                label="Phone Number"
                value={order.shippingPhone}
              />
              <Detail label="City" value={order.shippingCity} />
              <Detail label="Address" value={order.shippingAddress} />
              <div className="sm:col-span-2">
                <Detail label="Notes" value={order.shippingNotes} />
              </div>
            </dl>
          </OrderSection>

          <OrderSection icon={FileImage} title="Payment">
            <PaymentSection
              isError={paymentQuery.isError}
              isPending={paymentQuery.isPending}
              onRetry={() => void paymentQuery.refetch()}
              order={order}
              payment={payment}
            />
          </OrderSection>
        </div>

        <aside className="space-y-6">
          <section className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <ReceiptText
                aria-hidden="true"
                className="size-5 text-emerald-700"
              />
              <h2 className="text-lg font-semibold text-zinc-950">
                Order Summary
              </h2>
            </div>

            <dl className="mt-5 divide-y divide-zinc-200 border-y border-zinc-200">
              <SummaryRow
                icon={Hash}
                label="Order number"
                value={formatOrderNumber(order.id)}
              />
              <SummaryRow
                icon={CalendarDays}
                label="Date"
                value={formatOrderDateTime(order.createdAt)}
              />
              <SummaryRow
                icon={Building2}
                label="Seller"
                value={sellerLabels.join(", ")}
              />
              <SummaryRow
                icon={Banknote}
                label="Payment method"
                value={formatPaymentMethod(order.paymentMethod)}
              />
              <BadgeSummaryRow label="Payment status">
                {paymentQuery.isPending &&
                order.paymentMethod !== "CASH_ON_DELIVERY" ? (
                  <span
                    aria-label="Loading payment status"
                    className="block h-7 w-32 animate-pulse rounded-full bg-zinc-200"
                  />
                ) : (
                  <OrderPaymentStatusBadge
                    state={getOrderPaymentState(order, payment)}
                  />
                )}
              </BadgeSummaryRow>
              <BadgeSummaryRow label="Order status">
                <OrderStatusBadge status={order.status} />
              </BadgeSummaryRow>
            </dl>

            <div className="mt-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-zinc-600">Total price</p>
                <p className="mt-1 text-2xl font-semibold text-zinc-950">
                  {formatProductPrice(order.totalAmount)}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-start gap-2 border-t border-zinc-200 pt-4 text-xs leading-5 text-zinc-500">
              <Clock3
                aria-hidden="true"
                className="mt-0.5 size-3.5 shrink-0"
              />
              <span>Updated {formatOrderDateTime(order.updatedAt)}</span>
            </div>
          </section>

          <section className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-950">
              Order Timeline
            </h2>
            <OrderTimeline order={order} />
          </section>
        </aside>
      </div>
    </main>
  );
}

function OrderSection({
  children,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  icon: typeof Box;
  title: string;
}) {
  const headingId = `${title.toLowerCase().replaceAll(" ", "-")}-heading`;

  return (
    <section aria-labelledby={headingId}>
      <div className="flex items-center gap-3">
        <Icon aria-hidden="true" className="size-5 text-emerald-700" />
        <h2
          className="text-xl font-semibold text-zinc-950"
          id={headingId}
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function OrderItemRow({ item }: { item: CustomerOrderItem }) {
  const unitPrice = item.unitPrice ?? item.price;
  const subtotal =
    item.subtotal ?? (Number(unitPrice) * item.quantity).toFixed(2);

  return (
    <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-4 py-5 sm:grid-cols-[4.5rem_minmax(0,1fr)_minmax(8rem,auto)] sm:items-center">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-zinc-100 text-zinc-400">
        {item.product.imageUrl ? (
          <img
            alt={item.product.name}
            className="size-full object-cover"
            src={item.product.imageUrl}
          />
        ) : (
          <PackageOpen aria-hidden="true" className="size-6" />
        )}
      </div>
      <div className="min-w-0">
        <h3 className="font-semibold text-zinc-950">
          {item.product.name}
        </h3>
        <dl className="mt-2 grid grid-cols-2 gap-4 text-sm sm:max-w-sm">
          <div>
            <dt className="text-xs text-zinc-500">Quantity</dt>
            <dd className="mt-1 font-medium text-zinc-900">
              {item.quantity.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Unit price</dt>
            <dd className="mt-1 font-medium text-zinc-900">
              {formatProductPrice(unitPrice)}
            </dd>
          </div>
        </dl>
      </div>
      <div className="col-start-2 sm:col-start-auto sm:text-right">
        <p className="text-xs text-zinc-500">Subtotal</p>
        <p className="mt-1 font-semibold text-zinc-950">
          {formatProductPrice(subtotal)}
        </p>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-zinc-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium leading-6 text-zinc-950">
        {value || "Not provided"}
      </dd>
    </div>
  );
}

function PaymentSection({
  isError,
  isPending,
  onRetry,
  order,
  payment,
}: {
  isError: boolean;
  isPending: boolean;
  onRetry: () => void;
  order: CustomerOrder;
  payment: ManualPayment | null | undefined;
}) {
  if (order.paymentMethod === "CASH_ON_DELIVERY") {
    return (
      <div className="mt-4 flex items-start gap-3 border-y border-zinc-200 py-5">
        <Banknote
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-zinc-500"
        />
        <div>
          <OrderPaymentStatusBadge state="PAY_ON_DELIVERY" />
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Payment proof is not required for this order.
          </p>
        </div>
      </div>
    );
  }

  if (isPending) {
    return (
      <div
        aria-label="Loading payment information"
        className="mt-4 grid min-h-52 animate-pulse gap-5 border-y border-zinc-200 py-5 sm:grid-cols-[12rem_minmax(0,1fr)]"
      >
        <span className="block aspect-[4/3] rounded-md bg-zinc-200" />
        <div>
          <span className="block h-7 w-32 rounded-full bg-zinc-200" />
          <span className="mt-5 block h-4 w-44 rounded bg-zinc-200" />
          <span className="mt-3 block h-4 w-56 max-w-full rounded bg-zinc-200" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mt-4 flex min-h-40 items-center justify-between gap-5 border-y border-zinc-200 py-5">
        <div>
          <p className="font-semibold text-zinc-950">
            Payment information unavailable
          </p>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            The order is available, but its payment details could not be
            loaded.
          </p>
        </div>
        <button
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          onClick={onRetry}
          type="button"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="mt-4 flex flex-col items-start justify-between gap-5 border-y border-zinc-200 py-5 sm:flex-row sm:items-center">
        <div>
          <OrderPaymentStatusBadge state="NOT_SUBMITTED" />
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            No payment proof has been uploaded for this order.
          </p>
        </div>
        {order.status === "PENDING_PAYMENT" ? (
          <Link
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            to={`/orders/${encodeURIComponent(order.id)}/payment`}
          >
            <FileImage aria-hidden="true" className="size-4" />
            Submit proof
          </Link>
        ) : null}
      </div>
    );
  }

  const proofUrl = resolveApiAssetUrl(payment.proofImageUrl);

  return (
    <div className="mt-4 grid gap-5 border-y border-zinc-200 py-5 sm:grid-cols-[12rem_minmax(0,1fr)]">
      <a
        className="block overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        href={proofUrl}
        rel="noreferrer"
        target="_blank"
      >
        <img
          alt={`Payment proof for order ${formatOrderNumber(order.id)}`}
          className="aspect-[4/3] size-full object-contain"
          src={proofUrl}
        />
      </a>
      <div className="min-w-0">
        <OrderPaymentStatusBadge
          state={getOrderPaymentState(order, payment)}
        />
        {payment.status === "PENDING_VERIFICATION" ? (
          <p className="mt-3 text-sm font-semibold text-amber-800">
            Waiting for seller verification.
          </p>
        ) : null}
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Detail
            label="Payment method"
            value={formatPaymentMethod(payment.method)}
          />
          <Detail
            label="Upload date"
            value={formatOrderDateTime(payment.createdAt)}
          />
        </dl>
        <a
          className="mt-5 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          href={proofUrl}
          rel="noreferrer"
          target="_blank"
        >
          <ExternalLink aria-hidden="true" className="size-4" />
          Open screenshot
        </a>
      </div>
    </div>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 py-4">
      <Icon
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-zinc-500"
      />
      <div className="min-w-0">
        <dt className="text-xs font-medium uppercase text-zinc-500">
          {label}
        </dt>
        <dd className="mt-1 break-words text-sm font-semibold text-zinc-950">
          {value}
        </dd>
      </div>
    </div>
  );
}

function BadgeSummaryRow({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="py-4">
      <dt className="text-xs font-medium uppercase text-zinc-500">
        {label}
      </dt>
      <dd className="mt-2">{children}</dd>
    </div>
  );
}
