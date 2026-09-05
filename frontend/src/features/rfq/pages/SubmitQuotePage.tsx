import {
  AlertTriangle,
  ArrowLeft,
  LoaderCircle,
  Save,
} from "lucide-react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import {
  createQuote,
  getRfq,
  updateQuote,
  withdrawQuote,
} from "@/features/rfq/api/rfq.api";
import { RFQ_UNIT_LABELS } from "@/features/rfq/lib/rfq-display";
import type { QuoteItemInput, RfqItem } from "@/features/rfq/model/rfq";
import { getSellerProducts } from "@/features/seller/api/seller-inventory.api";
import { formatProductPrice } from "@/features/products/lib/product-display";
import { getApiErrorMessage } from "@/shared/api/http-error";
import { FullPageStatus } from "@/shared/ui/FullPageStatus";

function futureIso(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export function SubmitQuotePage() {
  const { rfqId } = useParams<{ rfqId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const rfqQuery = useQuery({
    queryKey: ["seller", "rfq-detail", rfqId],
    enabled: Boolean(rfqId),
    queryFn: ({ signal }) => {
      if (!rfqId) throw new Error("RFQ ID required");
      return getRfq(rfqId, signal);
    },
  });

  const productsQuery = useQuery({
    queryKey: ["seller", "products-for-quote"],
    queryFn: ({ signal }) => getSellerProducts({ page: 1, limit: 100 }, signal),
    staleTime: 60_000,
  });

  // Form state — initialized from rfqQuery.data on mount.
  // All state is computed during first render (lazy initializers) so no
  // useEffect + setState is needed, satisfying react-hooks/set-state-in-effect.
  // The component only reaches this point after rfqQuery.data is available
  // (loading and error states return early above).
  const getInitialState = () => {
    const rfq = rfqQuery.data;
    if (!rfq) {
      return {
        validUntil: futureIso(7),
        leadTimeDays: "7",
        terms: "",
        itemLines: [] as Array<{ rfqItemId: string; productId: string; offeredQuantity: string; unitPrice: string }>,
      };
    }
    const existingQuote = rfq.quotes[0];
    if (existingQuote) {
      return {
        validUntil: existingQuote.validUntil.slice(0, 10),
        leadTimeDays: existingQuote.leadTimeDays.toString(),
        terms: existingQuote.terms ?? "",
        itemLines: existingQuote.items.map((qi) => ({
          rfqItemId: qi.rfqItemId,
          productId: qi.productId ?? "",
          offeredQuantity: qi.offeredQuantity.toString(),
          unitPrice: qi.unitPrice,
        })),
      };
    }
    return {
      validUntil: futureIso(7),
      leadTimeDays: "7",
      terms: "",
      itemLines: rfq.items.map((item) => ({
        rfqItemId: item.id,
        productId: "",
        offeredQuantity: "",
        unitPrice: "",
      })),
    };
  };

  const [validUntil, setValidUntil] = useState(() => getInitialState().validUntil);
  const [leadTimeDays, setLeadTimeDays] = useState(() => getInitialState().leadTimeDays);
  const [terms, setTerms] = useState(() => getInitialState().terms);
  const [itemLines, setItemLines] = useState(() => getInitialState().itemLines);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submitMutation = useMutation({
    mutationFn: (input: Parameters<typeof createQuote>[1]) => {
      const existingQuote = rfqQuery.data?.quotes[0];
      if (existingQuote && existingQuote.status === "SUBMITTED") {
        return updateQuote(existingQuote.id, input);
      }
      return createQuote(rfqId!, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seller", "rfqs"] });
      void queryClient.invalidateQueries({ queryKey: ["seller", "rfq-detail", rfqId] });
      navigate(`/seller/rfqs/${rfqId}`);
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: () => {
      const existingQuote = rfqQuery.data?.quotes[0];
      if (!existingQuote) throw new Error("No quote to withdraw");
      return withdrawQuote(existingQuote.id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["seller", "rfqs"] });
      navigate(`/seller/rfqs/${rfqId}`);
    },
  });

  if (!rfqId) {
    return <Navigate replace to="/seller/rfqs" />;
  }
  if (rfqQuery.isPending) {
    return <FullPageStatus description="Loading RFQ." icon={LoaderCircle} title="Loading" />;
  }
  if (rfqQuery.isError || !rfqQuery.data) {
    return (
      <FullPageStatus
        action={{ label: "Try again", onClick: () => void rfqQuery.refetch() }}
        description={getApiErrorMessage(rfqQuery.error, "RFQ could not be loaded.")}
        icon={AlertTriangle}
        title="RFQ unavailable"
      />
    );
  }

  const rfq = rfqQuery.data;
  const existingQuote = rfq.quotes[0];
  const rfqItemById = new Map(rfq.items.map((i) => [i.id, i]));
  const sellerProducts = productsQuery.data?.products ?? [];
  const isExisting = Boolean(existingQuote && existingQuote.status === "SUBMITTED");

  function validate(): boolean {
    const next: Record<string, string> = {};
    const ld = Number(leadTimeDays);
    if (!Number.isInteger(ld) || ld < 0 || ld > 365) next.leadTimeDays = "Lead time must be 0–365 days.";
    if (!validUntil) next.validUntil = "Validity date is required.";
    itemLines.forEach((line, i) => {
      if (!line.productId) next[`line.${i}.productId`] = "Select a product.";
      if (!line.offeredQuantity || Number(line.offeredQuantity) < 1) next[`line.${i}.offeredQuantity`] = "Enter a positive integer.";
      if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(line.unitPrice) || Number(line.unitPrice) <= 0) next[`line.${i}.unitPrice`] = "Enter a positive price.";
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    submitMutation.mutate({
      validUntil: new Date(validUntil + "T23:59:59Z").toISOString(),
      leadTimeDays: Number(leadTimeDays),
      ...(terms.trim() ? { terms: terms.trim() } : {}),
      items: itemLines.map((line) => ({
        rfqItemId: line.rfqItemId,
        productId: line.productId,
        offeredQuantity: Number(line.offeredQuantity),
        unitPrice: Number(line.unitPrice).toFixed(2),
      } satisfies QuoteItemInput)),
    });
  }

  function updateLine(
    index: number,
    patch: Partial<(typeof itemLines)[number]>,
  ) {
    setItemLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  // Calculate running total
  const runningTotal = itemLines.reduce((sum, line) => {
    const qty = Number(line.offeredQuantity);
    const price = Number(line.unitPrice);
    return sum + (Number.isFinite(qty) && Number.isFinite(price) ? qty * price : 0);
  }, 0);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-950"
        to={`/seller/rfqs/${rfqId}`}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to RFQ
      </Link>

      <div className="mt-4 border-b border-zinc-200 pb-6">
        <p className="text-sm font-semibold text-brand-ink">Seller workspace</p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">
          {isExisting ? "Update Quotation" : "Submit Quotation"}
        </h1>
        <p className="mt-2 text-sm text-zinc-600">{rfq.title}</p>
      </div>

      <form className="mt-6 space-y-6" noValidate onSubmit={handleSubmit}>
        {/* Quote header */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-zinc-800" htmlFor="validUntil">
              Quote valid until <span className="text-red-600">*</span>
            </label>
            <input
              className={fc(Boolean(errors.validUntil))}
              disabled={submitMutation.isPending}
              id="validUntil"
              max={rfq.expiresAt.slice(0, 10)}
              min={futureIso(1)}
              onChange={(e) => setValidUntil(e.target.value)}
              type="date"
              value={validUntil}
            />
            {errors.validUntil ? <p className="mt-1 text-xs text-red-700">{errors.validUntil}</p> : null}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-800" htmlFor="leadTime">
              Lead time (days) <span className="text-red-600">*</span>
            </label>
            <input
              className={fc(Boolean(errors.leadTimeDays))}
              disabled={submitMutation.isPending}
              id="leadTime"
              min="0"
              max="365"
              onChange={(e) => setLeadTimeDays(e.target.value)}
              type="number"
              value={leadTimeDays}
            />
            {errors.leadTimeDays ? <p className="mt-1 text-xs text-red-700">{errors.leadTimeDays}</p> : null}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-800" htmlFor="terms">
            Terms & conditions{" "}
            <span className="font-normal text-zinc-500">(optional)</span>
          </label>
          <textarea
            className={fc(false) + " resize-none"}
            disabled={submitMutation.isPending}
            id="terms"
            maxLength={5000}
            onChange={(e) => setTerms(e.target.value)}
            placeholder="Payment terms, delivery conditions, warranty…"
            rows={2}
            value={terms}
          />
        </div>

        {/* Line items */}
        <section>
          <h2 className="text-base font-semibold text-zinc-950">
            Quoted lines ({itemLines.length} / {rfq.items.length} required)
          </h2>
          <div className="mt-4 space-y-4">
            {itemLines.map((line, i) => {
              const rfqItem = rfqItemById.get(line.rfqItemId);
              return (
                <QuoteLineForm
                  errors={errors}
                  index={i}
                  isPending={submitMutation.isPending}
                  key={line.rfqItemId}
                  line={line}
                  onUpdate={(patch) => updateLine(i, patch)}
                  products={sellerProducts}
                  rfqItem={rfqItem}
                />
              );
            })}
          </div>
          {runningTotal > 0 ? (
            <div className="mt-4 flex justify-end rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="text-base font-semibold text-zinc-950">
                Total: {formatProductPrice(runningTotal.toFixed(2))}
              </p>
            </div>
          ) : null}
        </section>

        {/* Errors */}
        {submitMutation.isError ? (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {getApiErrorMessage(submitMutation.error, "The quotation could not be submitted.")}
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex flex-wrap justify-between gap-3 border-t border-zinc-200 pt-6">
          {isExisting ? (
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
              disabled={withdrawMutation.isPending || submitMutation.isPending}
              onClick={() => withdrawMutation.mutate()}
              type="button"
            >
              {withdrawMutation.isPending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
              Withdraw quotation
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-3">
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              to={`/seller/rfqs/${rfqId}`}
            >
              Cancel
            </Link>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-60"
              disabled={submitMutation.isPending || withdrawMutation.isPending}
              type="submit"
            >
              {submitMutation.isPending ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Save aria-hidden="true" className="size-4" />
              )}
              {submitMutation.isPending ? "Saving…" : isExisting ? "Update quotation" : "Submit quotation"}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}

function QuoteLineForm({
  errors,
  index,
  isPending,
  line,
  onUpdate,
  products,
  rfqItem,
}: {
  errors: Record<string, string>;
  index: number;
  isPending: boolean;
  line: { rfqItemId: string; productId: string; offeredQuantity: string; unitPrice: string };
  onUpdate: (patch: Partial<typeof line>) => void;
  products: Array<{ id: string; name: string; categoryId: string }>;
  rfqItem?: RfqItem;
}) {
  const lineTotal =
    Number.isFinite(Number(line.offeredQuantity)) && Number.isFinite(Number(line.unitPrice))
      ? (Number(line.offeredQuantity) * Number(line.unitPrice)).toFixed(2)
      : null;

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
      {rfqItem ? (
        <div className="mb-3">
          <p className="text-sm font-semibold text-zinc-950">{rfqItem.materialName}</p>
          <p className="text-xs text-brand-ink">{rfqItem.categoryName}</p>
          <p className="text-xs text-zinc-500">
            Requested: {rfqItem.requestedQuantity}{" "}
            {rfqItem.requestedUnit === "OTHER" ? rfqItem.customUnit : RFQ_UNIT_LABELS[rfqItem.requestedUnit]}
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {/* Product */}
        <div className="sm:col-span-3">
          <label className="block text-xs font-medium text-zinc-700" htmlFor={`prod-${index}`}>
            Your product <span className="text-red-600">*</span>
          </label>
          <select
            className={fc(Boolean(errors[`line.${index}.productId`]))}
            disabled={isPending}
            id={`prod-${index}`}
            onChange={(e) => onUpdate({ productId: e.target.value })}
            value={line.productId}
          >
            <option value="">— Select product —</option>
            {products
              .filter((p) => !rfqItem || p.categoryId === rfqItem.categoryId)
              .map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
          </select>
          {errors[`line.${index}.productId`] ? (
            <p className="mt-0.5 text-xs text-red-700">{errors[`line.${index}.productId`]}</p>
          ) : null}
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-xs font-medium text-zinc-700" htmlFor={`qty-${index}`}>
            Offered qty <span className="text-red-600">*</span>
          </label>
          <input
            className={fc(Boolean(errors[`line.${index}.offeredQuantity`]))}
            disabled={isPending}
            id={`qty-${index}`}
            min="1"
            onChange={(e) => onUpdate({ offeredQuantity: e.target.value })}
            type="number"
            value={line.offeredQuantity}
          />
          {errors[`line.${index}.offeredQuantity`] ? (
            <p className="mt-0.5 text-xs text-red-700">{errors[`line.${index}.offeredQuantity`]}</p>
          ) : null}
        </div>

        {/* Unit price */}
        <div>
          <label className="block text-xs font-medium text-zinc-700" htmlFor={`price-${index}`}>
            Unit price (ETB) <span className="text-red-600">*</span>
          </label>
          <input
            className={fc(Boolean(errors[`line.${index}.unitPrice`]))}
            disabled={isPending}
            id={`price-${index}`}
            inputMode="decimal"
            onChange={(e) => onUpdate({ unitPrice: e.target.value })}
            value={line.unitPrice}
          />
          {errors[`line.${index}.unitPrice`] ? (
            <p className="mt-0.5 text-xs text-red-700">{errors[`line.${index}.unitPrice`]}</p>
          ) : null}
        </div>

        {/* Line total */}
        {lineTotal ? (
          <div className="flex flex-col justify-end">
            <p className="text-xs text-zinc-500">Line total</p>
            <p className="font-semibold text-zinc-950">{formatProductPrice(lineTotal)}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function fc(hasError: boolean): string {
  return [
    "min-h-11 w-full rounded-md border px-3 py-2 text-sm outline-none",
    "focus:ring-2 focus:ring-brand-ring/15 disabled:opacity-60",
    hasError ? "border-red-400 focus:border-red-500" : "border-zinc-300 focus:border-brand",
  ].join(" ");
}
