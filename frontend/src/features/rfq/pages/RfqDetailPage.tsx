import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  MapPin,
  PackageOpen,
  RefreshCw,
  XCircle,
} from "lucide-react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { useAuthStore } from "@/features/auth/model/auth.store";
import {
  acceptQuote,
  cancelRfq,
  getRfq,
  rejectQuote,
} from "@/features/rfq/api/rfq.api";
import {
  formatRfqDate,
  formatRfqDateTime,
  formatRfqStatus,
  formatQuoteStatus,
  quoteStatusColor,
  rfqStatusColor,
  daysUntilExpiry,
  RFQ_UNIT_LABELS,
} from "@/features/rfq/lib/rfq-display";
import type { RequestForQuote, SupplierQuote } from "@/features/rfq/model/rfq";
import { formatProductPrice } from "@/features/products/lib/product-display";
import { getApiErrorMessage } from "@/shared/api/http-error";
import { FullPageStatus } from "@/shared/ui/FullPageStatus";

const REFRESH_INTERVAL = 30_000;

export function RfqDetailPage() {
  const { rfqId } = useParams<{ rfqId: string }>();
  const authStatus = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const rfqQuery = useQuery({
    queryKey: ["rfqs", "detail", rfqId],
    enabled: Boolean(rfqId) && authStatus === "authenticated",
    queryFn: ({ signal }) => {
      if (!rfqId) throw new Error("RFQ ID required");
      return getRfq(rfqId, signal);
    },
    refetchInterval: REFRESH_INTERVAL,
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelRfq(rfqId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rfqs"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (quoteId: string) => rejectQuote(quoteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["rfqs", "detail", rfqId] });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (quoteId: string) => acceptQuote(quoteId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["rfqs"] });
      navigate(`/orders/${encodeURIComponent(result.order.id)}`, { replace: true });
    },
  });

  if (!rfqId || authStatus !== "authenticated" || !user) {
    return <Navigate replace state={{ returnTo: `/rfqs/${rfqId}` }} to="/login" />;
  }
  if (rfqQuery.isPending) {
    return (
      <FullPageStatus
        description="Loading request for quotation."
        icon={LoaderCircle}
        title="Loading RFQ"
      />
    );
  }
  if (rfqQuery.isError || !rfqQuery.data) {
    return (
      <FullPageStatus
        action={{ label: "Try again", onClick: () => void rfqQuery.refetch() }}
        description={getApiErrorMessage(rfqQuery.error, "This RFQ could not be loaded.")}
        icon={AlertTriangle}
        title="RFQ unavailable"
      />
    );
  }

  const rfq = rfqQuery.data;
  const isOwner = rfq.customerId === user.id;
  const isSeller = user.role === "SELLER";
  const isOpen = rfq.status === "OPEN";
  const days = daysUntilExpiry(rfq.expiresAt);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      {/* Nav */}
      <div className="flex items-center justify-between gap-4">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-950"
          to={isSeller ? "/seller/rfqs" : "/rfqs"}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {isSeller ? "Available RFQs" : "My RFQs"}
        </Link>
        <button
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
          disabled={rfqQuery.isFetching}
          onClick={() => void rfqQuery.refetch()}
          type="button"
        >
          <RefreshCw
            aria-hidden="true"
            className={`size-4 ${rfqQuery.isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-sm font-semibold text-emerald-700">
            Request for Quotation
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">
            {rfq.title}
          </h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-zinc-600">
            <MapPin aria-hidden="true" className="size-4 shrink-0" />
            {rfq.deliveryLocation}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${rfqStatusColor(rfq.status)}`}
          >
            {formatRfqStatus(rfq.status)}
          </span>
          {isOpen ? (
            <p className={`text-xs font-medium ${days <= 2 ? "text-red-600" : "text-zinc-500"}`}>
              Expires {days <= 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Main content */}
        <div className="min-w-0 space-y-8">
          {/* RFQ details */}
          <section>
            <h2 className="text-lg font-semibold text-zinc-950">Details</h2>
            <dl className="mt-4 grid gap-5 border-y border-zinc-200 py-5 sm:grid-cols-2">
              <Detail label="Customer" value={rfq.customer.name} />
              {rfq.customer.company ? (
                <Detail label="Company" value={rfq.customer.company} />
              ) : null}
              <Detail label="Created" value={formatRfqDateTime(rfq.createdAt)} />
              <Detail label="Deadline" value={formatRfqDate(rfq.expiresAt)} />
              {rfq.notes ? (
                <div className="sm:col-span-2">
                  <Detail label="Notes" value={rfq.notes} />
                </div>
              ) : null}
            </dl>
          </section>

          {/* Material items */}
          <section>
            <h2 className="text-lg font-semibold text-zinc-950">
              Requested Materials
            </h2>
            <div className="mt-4 divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white">
              {rfq.items.map((item, i) => (
                <div className="p-4" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-zinc-950">
                        {i + 1}. {item.materialName}
                      </p>
                      <p className="mt-1 text-sm text-emerald-700">
                        {item.categoryName}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-zinc-950">
                      {item.requestedQuantity}{" "}
                      {item.requestedUnit === "OTHER"
                        ? (item.customUnit ?? "Other")
                        : RFQ_UNIT_LABELS[item.requestedUnit]}
                    </p>
                  </div>
                  {item.specifications ? (
                    <p className="mt-2 text-sm text-zinc-600">
                      {item.specifications}
                    </p>
                  ) : null}
                  {item.preferredProduct ? (
                    <p className="mt-2 text-xs text-zinc-500">
                      Preferred product: {item.preferredProduct.name}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          {/* Quotes */}
          {(isOwner || isSeller) && rfq.quotes.length > 0 ? (
            <section>
              <h2 className="text-lg font-semibold text-zinc-950">
                {isOwner ? "Supplier Quotations" : "Your Quotation"}
              </h2>
              <div className="mt-4 space-y-4">
                {rfq.quotes.map((quote) => (
                  <QuoteCard
                    acceptError={acceptMutation.isError && acceptMutation.variables === quote.id
                      ? getApiErrorMessage(acceptMutation.error, "Quote could not be accepted.")
                      : undefined}
                    isAccepting={acceptMutation.isPending && acceptMutation.variables === quote.id}
                    isAwarded={rfq.awardedQuoteId === quote.id}
                    isOwner={isOwner}
                    isRejecting={rejectMutation.isPending && rejectMutation.variables === quote.id}
                    key={quote.id}
                    onAccept={isOwner && isOpen ? () => acceptMutation.mutate(quote.id) : undefined}
                    onReject={isOwner && isOpen && quote.status === "SUBMITTED"
                      ? () => rejectMutation.mutate(quote.id)
                      : undefined}
                    quote={quote}
                    rfqItems={rfq.items}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {/* Sidebar */}
        <aside className="space-y-5">
          {/* Summary */}
          <section className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950">
              <Clock3 aria-hidden="true" className="size-4 text-emerald-700" />
              Summary
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <SummaryRow label="Items" value={rfq.items.length.toString()} />
              <SummaryRow label="Quotes received" value={rfq.quotes.length.toString()} />
              <SummaryRow label="Status" value={formatRfqStatus(rfq.status)} />
              {rfq.awardedQuoteId ? (
                <SummaryRow label="Awarded" value="Yes — order created" />
              ) : null}
            </dl>
          </section>

          {/* Owner actions */}
          {isOwner && isOpen && rfq.quotes.length === 0 ? (
            <section className="rounded-md border border-amber-200 bg-amber-50 p-5">
              <h2 className="text-sm font-semibold text-amber-900">Cancel RFQ</h2>
              <p className="mt-2 text-xs leading-5 text-amber-800">
                You can cancel this RFQ while no quotations have been submitted.
              </p>
              {cancelMutation.isError ? (
                <p className="mt-2 text-xs text-red-700" role="alert">
                  {getApiErrorMessage(cancelMutation.error, "Could not cancel the RFQ.")}
                </p>
              ) : null}
              <button
                className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-200 disabled:opacity-60"
                disabled={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate()}
                type="button"
              >
                {cancelMutation.isPending ? (
                  <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <XCircle aria-hidden="true" className="size-4" />
                )}
                Cancel RFQ
              </button>
            </section>
          ) : null}

          {/* Seller: link to submit quote */}
          {isSeller && isOpen && rfq.quotes.length === 0 ? (
            <Link
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              to={`/seller/rfqs/${rfqId}/quote`}
            >
              <BadgeCheck aria-hidden="true" className="size-4" />
              Submit quotation
            </Link>
          ) : null}

          {/* Seller: already quoted */}
          {isSeller && rfq.quotes.length > 0 ? (
            <Link
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              to={`/seller/rfqs/${rfqId}/quote`}
            >
              Edit your quotation
            </Link>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

function QuoteCard({
  acceptError,
  isAccepting,
  isAwarded,
  isOwner,
  isRejecting,
  onAccept,
  onReject,
  quote,
  rfqItems,
}: {
  acceptError?: string;
  isAccepting: boolean;
  isAwarded: boolean;
  isOwner: boolean;
  isRejecting: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  quote: SupplierQuote;
  rfqItems: RequestForQuote["items"];
}) {
  const rfqItemById = new Map(rfqItems.map((i) => [i.id, i]));
  const storeName = quote.seller.shopName || quote.seller.name;

  return (
    <article
      className={`rounded-md border bg-white p-5 shadow-sm ${
        isAwarded ? "border-emerald-300" : "border-zinc-200"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-zinc-950">{storeName}</p>
          {quote.seller.company ? (
            <p className="text-sm text-zinc-500">{quote.seller.company}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${quoteStatusColor(quote.status)}`}
          >
            {formatQuoteStatus(quote.status)}
          </span>
          {isAwarded ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 aria-hidden="true" className="size-3.5" />
              Awarded
            </span>
          ) : null}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-zinc-200 py-4 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase text-zinc-500">Total</dt>
          <dd className="mt-1 text-lg font-semibold text-zinc-950">
            {formatProductPrice(quote.totalAmount)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-zinc-500">Lead time</dt>
          <dd className="mt-1 font-semibold text-zinc-950">
            {quote.leadTimeDays} day{quote.leadTimeDays === 1 ? "" : "s"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-zinc-500">Quote valid until</dt>
          <dd className="mt-1 font-semibold text-zinc-950">
            {formatRfqDate(quote.validUntil)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-zinc-500">Submitted</dt>
          <dd className="mt-1 font-semibold text-zinc-950">
            {formatRfqDate(quote.createdAt)}
          </dd>
        </div>
      </dl>

      {/* Line items */}
      <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold uppercase text-zinc-500">Quoted lines</p>
        {quote.items.map((qi) => {
          const rfqItem = rfqItemById.get(qi.rfqItemId);
          return (
            <div className="flex items-start gap-3 rounded-md border border-zinc-100 bg-zinc-50 p-3" key={qi.id}>
              <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded bg-white text-zinc-400 border border-zinc-200">
                {qi.product?.imageUrl ? (
                  <img alt="" className="size-full object-cover" src={qi.product.imageUrl} />
                ) : (
                  <PackageOpen aria-hidden="true" className="size-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-950">{qi.productName}</p>
                {rfqItem ? (
                  <p className="text-xs text-zinc-500">
                    Requested: {rfqItem.requestedQuantity} {rfqItem.requestedUnit === "OTHER" ? rfqItem.customUnit : rfqItem.requestedUnit}
                  </p>
                ) : null}
                <p className="text-xs text-zinc-600">
                  Offered: {qi.offeredQuantity} × {formatProductPrice(qi.unitPrice)} = {formatProductPrice(qi.lineTotal)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {quote.terms ? (
        <p className="mt-3 text-sm text-zinc-600">
          <span className="font-medium">Terms: </span>{quote.terms}
        </p>
      ) : null}

      {/* Accept / Reject actions */}
      {isOwner && (onAccept || onReject) ? (
        <div className="mt-4 flex flex-col gap-2 border-t border-zinc-200 pt-4">
          {acceptError ? (
            <p className="text-xs text-red-700" role="alert">{acceptError}</p>
          ) : null}
          <div className="flex gap-3">
            {onReject ? (
              <button
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
                disabled={isRejecting || isAccepting}
                onClick={onReject}
                type="button"
              >
                {isRejecting ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <XCircle aria-hidden="true" className="size-4 text-red-500" />}
                Reject
              </button>
            ) : null}
            {onAccept ? (
              <button
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                disabled={isAccepting || isRejecting}
                onClick={onAccept}
                type="button"
              >
                {isAccepting ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <CheckCircle2 aria-hidden="true" className="size-4" />}
                Accept & Order
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase text-zinc-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-zinc-950">{value || "Not provided"}</dd>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-semibold text-zinc-950">{value}</dd>
    </div>
  );
}
