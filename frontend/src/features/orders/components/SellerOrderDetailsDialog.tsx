import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  Check,
  ExternalLink,
  LoaderCircle,
  MapPin,
  PackageOpen,
  Phone,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { ConfirmCartActionDialog } from "@/features/cart/components/ConfirmCartActionDialog";
import {
  getSellerOrderById,
  updateOrderStatus,
  verifySellerOrderPayment,
} from "@/features/seller/api/seller-orders.api";
import { PaymentProofStatusBadge } from "@/features/orders/components/PaymentProofStatusBadge";
import { SellerWorkflowStatusBadge } from "@/features/orders/components/SellerWorkflowStatusBadge";
import {
  formatOrderDateTime,
  formatOrderNumber,
  formatPaymentMethod,
} from "@/features/orders/lib/order-display";
import {
  canSellerCancelOrder,
  getSellerPrimaryOrderAction,
} from "@/features/orders/lib/seller-order-workflow";
import { formatProductPrice } from "@/features/products/lib/product-display";
import { resolvePaymentProofUrl } from "@/features/seller/lib/seller-order-display";
import type {
  SellerOrder,
  SellerOrderItem,
  SellerOrderStatusUpdate,
  SellerPaymentDecision,
} from "@/features/seller/model/seller-order";
import { getApiErrorMessage } from "@/shared/api/http-error";

interface SellerOrderDetailsDialogProps {
  onClose: () => void;
  orderId: string;
}

export function SellerOrderDetailsDialog({
  onClose,
  orderId,
}: SellerOrderDetailsDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const orderQuery = useQuery({
    queryKey: ["seller", "orders", "details", orderId],
    queryFn: ({ signal }) => getSellerOrderById(orderId, signal),
  });
  const updateCachedOrder = (order: SellerOrder) => {
    queryClient.setQueryData(
      ["seller", "orders", "details", order.id],
      order,
    );
    void queryClient.invalidateQueries({
      queryKey: ["seller", "orders"],
    });
    void queryClient.invalidateQueries({
      queryKey: ["seller", "dashboard"],
    });
  };
  const statusMutation = useMutation({
    mutationFn: (status: SellerOrderStatusUpdate) =>
      updateOrderStatus(orderId, status),
    onSuccess: (order) => {
      setIsCancelOpen(false);
      updateCachedOrder(order);
      if (order.status === "SHIPPED") {
        void queryClient.invalidateQueries({
          queryKey: ["seller", "inventory"],
        });
        void queryClient.invalidateQueries({
          queryKey: ["products"],
        });
      }
    },
  });
  const paymentMutation = useMutation({
    mutationFn: (decision: SellerPaymentDecision) =>
      verifySellerOrderPayment(orderId, decision),
    onSuccess: updateCachedOrder,
  });
  const isMutating =
    statusMutation.isPending || paymentMutation.isPending;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape" && !isMutating && !isCancelOpen) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCancelOpen, isMutating, onClose]);

  const order = orderQuery.data;
  const mutationError = statusMutation.error ?? paymentMutation.error;
  const primaryAction = order
    ? getSellerPrimaryOrderAction(order.status)
    : null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-end justify-center bg-zinc-950/50 p-0 sm:items-center sm:p-6"
        onMouseDown={(event) => {
          if (
            event.currentTarget === event.target &&
            !isMutating &&
            !isCancelOpen
          ) {
            onClose();
          }
        }}
      >
        <section
          aria-labelledby="seller-order-details-title"
          aria-modal="true"
          className="flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-md bg-stone-50 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:max-w-5xl sm:rounded-md"
          role="dialog"
        >
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-200 bg-white px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-700">
                Customer order
              </p>
              <h2
                className="mt-1 truncate text-xl font-semibold text-zinc-950 sm:text-2xl"
                id="seller-order-details-title"
              >
                {order
                  ? `Order ${formatOrderNumber(order.id)}`
                  : "Order details"}
              </h2>
              {order ? (
                <p className="mt-1 truncate font-mono text-xs text-zinc-500">
                  {order.id}
                </p>
              ) : null}
            </div>
            <button
              aria-label="Close order details"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 disabled:opacity-50"
              disabled={isMutating}
              onClick={onClose}
              ref={closeButtonRef}
              title="Close"
              type="button"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {orderQuery.isPending ? (
              <DialogStatus
                description="Loading customer and fulfillment information."
                icon={LoaderCircle}
                title="Loading order"
              />
            ) : orderQuery.isError || !order ? (
              <DialogStatus
                action={() => void orderQuery.refetch()}
                description={getApiErrorMessage(
                  orderQuery.error,
                  "The order details could not be loaded.",
                )}
                icon={AlertTriangle}
                title="Order unavailable"
              />
            ) : (
              <div className="px-4 py-6 sm:px-6">
                {mutationError ? (
                  <div
                    className="mb-6 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                    role="alert"
                  >
                    <AlertTriangle
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0"
                    />
                    {getApiErrorMessage(
                      mutationError,
                      "The order could not be updated.",
                    )}
                  </div>
                ) : null}

                <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
                  <div className="min-w-0 space-y-8">
                    <OrderSection
                      icon={UserRound}
                      title="Customer delivery information"
                    >
                      <dl className="grid gap-5 sm:grid-cols-2">
                        <Detail
                          label="Customer"
                          value={order.customer.name}
                        />
                        <Detail
                          label="Email"
                          value={order.customer.email}
                        />
                        <Detail
                          label="Recipient"
                          value={order.shippingFullName}
                        />
                        <Detail
                          label="Phone"
                          value={order.shippingPhone}
                        />
                        <Detail
                          label="City"
                          value={order.shippingCity}
                        />
                        <Detail
                          label="Delivery address"
                          value={order.shippingAddress}
                        />
                        {order.shippingNotes ? (
                          <Detail
                            label="Delivery notes"
                            value={order.shippingNotes}
                          />
                        ) : null}
                      </dl>
                    </OrderSection>

                    <OrderSection icon={PackageOpen} title="Products">
                      <div className="divide-y divide-zinc-200">
                        {order.items.map((item) => (
                          <OrderItemRow item={item} key={item.id} />
                        ))}
                      </div>
                    </OrderSection>

                    <OrderSection icon={BadgeCheck} title="Payment proof">
                      <PaymentProof order={order} />
                    </OrderSection>
                  </div>

                  <aside className="border-t border-zinc-200 pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                    <h3 className="text-base font-semibold text-zinc-950">
                      Order summary
                    </h3>
                    <dl className="mt-4 divide-y divide-zinc-200 border-y border-zinc-200">
                      <SummaryRow
                        label="Order date"
                        value={formatOrderDateTime(order.createdAt)}
                      />
                      <SummaryRow
                        label="Payment method"
                        value={formatPaymentMethod(order.paymentMethod)}
                      />
                      <SummaryRow
                        label="Products"
                        value={order.items.length.toLocaleString()}
                      />
                      <SummaryRow
                        label="Total quantity"
                        value={order.totalItems.toLocaleString()}
                      />
                      <SummaryRow
                        label="Total amount"
                        value={formatProductPrice(order.sellerTotal)}
                      />
                      <div className="py-4">
                        <dt className="text-xs font-medium uppercase text-zinc-500">
                          Current status
                        </dt>
                        <dd className="mt-2">
                          <SellerWorkflowStatusBadge
                            status={order.status}
                          />
                        </dd>
                      </div>
                    </dl>
                  </aside>
                </div>
              </div>
            )}
          </div>

          {order ? (
            <footer className="shrink-0 border-t border-zinc-200 bg-white px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <PaymentActions
                  isPending={isMutating}
                  onDecision={(decision) =>
                    paymentMutation.mutate(decision)
                  }
                  order={order}
                />
                <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
                  {canSellerCancelOrder(order.status) ? (
                    <button
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      disabled={isMutating}
                      onClick={() => setIsCancelOpen(true)}
                      type="button"
                    >
                      <XCircle aria-hidden="true" className="size-4" />
                      Cancel order
                    </button>
                  ) : null}
                  {primaryAction ? (
                    <button
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isMutating}
                      onClick={() =>
                        statusMutation.mutate(primaryAction.status)
                      }
                      type="button"
                    >
                      {statusMutation.isPending ? (
                        <LoaderCircle
                          aria-hidden="true"
                          className="size-4 animate-spin"
                        />
                      ) : (
                        <Check aria-hidden="true" className="size-4" />
                      )}
                      {primaryAction.label}
                    </button>
                  ) : null}
                </div>
              </div>
            </footer>
          ) : null}
        </section>
      </div>

      <ConfirmCartActionDialog
        actionLabel="Cancel order"
        description={
          order
            ? `Cancel order ${formatOrderNumber(order.id)} for ${order.customer.name}? This stops seller fulfillment for the order.`
            : ""
        }
        isOpen={isCancelOpen}
        isPending={statusMutation.isPending}
        onCancel={() => {
          if (!statusMutation.isPending) {
            setIsCancelOpen(false);
          }
        }}
        onConfirm={() => statusMutation.mutate("CANCELLED")}
        title="Cancel customer order"
      />
    </>
  );
}

function DialogStatus({
  action,
  description,
  icon: Icon,
  title,
}: {
  action?: () => void;
  description: string;
  icon: typeof LoaderCircle;
  title: string;
}) {
  return (
    <div className="flex min-h-96 items-center justify-center px-6 py-16 text-center">
      <div className="max-w-sm">
        <Icon
          aria-hidden="true"
          className={`mx-auto size-7 text-zinc-400 ${
            Icon === LoaderCircle ? "animate-spin" : ""
          }`}
        />
        <h3 className="mt-4 text-lg font-semibold text-zinc-950">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          {description}
        </p>
        {action ? (
          <button
            className="mt-5 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            onClick={action}
            type="button"
          >
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}

function OrderSection({
  children,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  icon: typeof UserRound;
  title: string;
}) {
  return (
    <section>
      <div className="flex items-center gap-3 border-b border-zinc-200 pb-3">
        <Icon aria-hidden="true" className="size-5 text-emerald-700" />
        <h3 className="text-lg font-semibold text-zinc-950">{title}</h3>
      </div>
      <div className="pt-4">{children}</div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-2 text-xs font-medium uppercase text-zinc-500">
        {label === "Phone" ? (
          <Phone aria-hidden="true" className="size-3.5" />
        ) : label === "Delivery address" || label === "City" ? (
          <MapPin aria-hidden="true" className="size-3.5" />
        ) : null}
        {label}
      </dt>
      <dd className="mt-1.5 text-sm font-medium leading-6 text-zinc-950">
        {value}
      </dd>
    </div>
  );
}

function OrderItemRow({ item }: { item: SellerOrderItem }) {
  return (
    <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 py-4 first:pt-0 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:items-center">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-zinc-100 text-zinc-400">
        {item.product.imageUrl ? (
          <img
            alt=""
            className="size-full object-cover"
            src={item.product.imageUrl}
          />
        ) : (
          <PackageOpen aria-hidden="true" className="size-5" />
        )}
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-zinc-950">
          {item.product.name}
        </p>
        <p className="mt-1 text-sm text-zinc-600">
          {item.quantity.toLocaleString()} x{" "}
          {formatProductPrice(item.price)}
        </p>
      </div>
      <p className="col-start-2 font-semibold text-zinc-950 sm:col-start-auto">
        {formatProductPrice(item.lineTotal)}
      </p>
    </div>
  );
}

function PaymentProof({ order }: { order: SellerOrder }) {
  if (!order.payment) {
    return (
      <div className="flex items-start gap-3 text-sm text-zinc-600">
        <Banknote
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-zinc-400"
        />
        <div>
          <p className="font-medium text-zinc-950">
            {order.paymentMethod === "CASH_ON_DELIVERY"
              ? "Cash on delivery"
              : "Payment proof not submitted"}
          </p>
          <p className="mt-1">
            {order.paymentMethod === "CASH_ON_DELIVERY"
              ? "The customer pays when the order is delivered."
              : "The customer must upload payment proof before verification."}
          </p>
        </div>
      </div>
    );
  }

  const proofUrl = resolvePaymentProofUrl(order.payment.proofImageUrl);

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
      <div>
        <PaymentProofStatusBadge status={order.payment.status} />
        <p className="mt-3 text-sm font-medium text-zinc-950">
          {order.payment.providerName}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Submitted {formatOrderDateTime(order.payment.createdAt)}
        </p>
        <a
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
          href={proofUrl}
          rel="noreferrer"
          target="_blank"
        >
          <ExternalLink aria-hidden="true" className="size-4" />
          Open payment proof
        </a>
      </div>
      <a
        className="block overflow-hidden rounded-md border border-zinc-200 bg-zinc-100"
        href={proofUrl}
        rel="noreferrer"
        target="_blank"
      >
        <img
          alt={`Payment proof for ${formatOrderNumber(order.id)}`}
          className="aspect-[4/3] size-full object-contain"
          src={proofUrl}
        />
      </a>
    </div>
  );
}

function PaymentActions({
  isPending,
  onDecision,
  order,
}: {
  isPending: boolean;
  onDecision: (decision: SellerPaymentDecision) => void;
  order: SellerOrder;
}) {
  if (
    order.status !== "PENDING_PAYMENT_VERIFICATION" ||
    order.payment?.status !== "PENDING_VERIFICATION"
  ) {
    return <span />;
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <button
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
        disabled={isPending}
        onClick={() => onDecision("REJECT")}
        type="button"
      >
        <XCircle aria-hidden="true" className="size-4" />
        Reject payment
      </button>
      <button
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        disabled={isPending}
        onClick={() => onDecision("APPROVE")}
        type="button"
      >
        <BadgeCheck aria-hidden="true" className="size-4" />
        Approve and confirm
      </button>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-4">
      <dt className="text-xs font-medium uppercase text-zinc-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-zinc-950">
        {value}
      </dd>
    </div>
  );
}
