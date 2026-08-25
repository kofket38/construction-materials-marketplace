import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LoaderCircle,
  MapPin,
} from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { getSellerRfqs } from "@/features/rfq/api/rfq.api";
import {
  daysUntilExpiry,
  formatRfqDate,
  formatRfqStatus,
  rfqStatusColor,
} from "@/features/rfq/lib/rfq-display";
import type { RequestForQuote } from "@/features/rfq/model/rfq";
import { getApiErrorMessage } from "@/shared/api/http-error";
import { FullPageStatus } from "@/shared/ui/FullPageStatus";

const PAGE_SIZE = 20;

export function SellerRfqsPage() {
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"available" | "participating">("available");

  const rfqsQuery = useQuery({
    queryKey: ["seller", "rfqs", { page, view }],
    queryFn: ({ signal }) =>
      getSellerRfqs({ page, limit: PAGE_SIZE, view }, signal),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  if (rfqsQuery.isPending) {
    return (
      <FullPageStatus
        description="Loading RFQ opportunities."
        icon={LoaderCircle}
        title="Loading RFQs"
      />
    );
  }
  if (rfqsQuery.isError) {
    return (
      <FullPageStatus
        action={{ label: "Try again", onClick: () => void rfqsQuery.refetch() }}
        description={getApiErrorMessage(rfqsQuery.error, "RFQs could not be loaded.")}
        icon={AlertTriangle}
        title="RFQs unavailable"
      />
    );
  }

  const { rfqs, pagination } = rfqsQuery.data!;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Seller workspace</p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">
            Requests for Quotation
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Browse open RFQs matching your catalog categories and submit quotes.
          </p>
        </div>
        <p className="text-sm text-zinc-600">
          {pagination.total} {pagination.total === 1 ? "RFQ" : "RFQs"}
        </p>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex gap-1 border-b border-zinc-200">
        {(["available", "participating"] as const).map((tab) => (
          <button
            className={`inline-flex min-h-10 items-center border-b-2 px-4 pb-2 text-sm font-semibold transition-colors ${
              view === tab
                ? "border-emerald-700 text-emerald-700"
                : "border-transparent text-zinc-500 hover:text-zinc-950"
            }`}
            key={tab}
            onClick={() => { setView(tab); setPage(1); }}
            type="button"
          >
            {tab === "available" ? "Available" : "Participating"}
          </button>
        ))}
      </div>

      {rfqs.length === 0 ? (
        <section className="py-16 text-center">
          <ClipboardList aria-hidden="true" className="mx-auto size-8 text-zinc-400" />
          <h2 className="mt-4 text-lg font-semibold text-zinc-950">
            {view === "available" ? "No open RFQs for your categories" : "No active participations"}
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            {view === "available"
              ? "RFQs will appear here when customers request materials in your catalog categories."
              : "Submit a quote on an available RFQ to start participating."}
          </p>
        </section>
      ) : (
        <div className="mt-5 space-y-3">
          {rfqs.map((rfq) => (
            <SellerRfqCard key={rfq.id} rfq={rfq} />
          ))}
        </div>
      )}

      {pagination.totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-sm text-zinc-600">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              aria-label="Previous page"
              className="inline-flex size-10 items-center justify-center rounded-md border border-zinc-300 bg-white hover:bg-zinc-50 disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              type="button"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
            <button
              aria-label="Next page"
              className="inline-flex size-10 items-center justify-center rounded-md border border-zinc-300 bg-white hover:bg-zinc-50 disabled:opacity-50"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              type="button"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function SellerRfqCard({ rfq }: { rfq: RequestForQuote }) {
  const days = daysUntilExpiry(rfq.expiresAt);
  const myQuote = rfq.quotes[0];

  return (
    <Link
      className="group block rounded-md border border-zinc-200 bg-white p-5 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50"
      to={`/seller/rfqs/${rfq.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate font-semibold text-zinc-950">{rfq.title}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-500">
            <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
            {rfq.deliveryLocation}
          </p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${rfqStatusColor(rfq.status)}`}
        >
          {formatRfqStatus(rfq.status)}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-zinc-200 pt-4 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase text-zinc-500">Items</dt>
          <dd className="mt-1 font-semibold text-zinc-950">{rfq.items.length}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-zinc-500">Deadline</dt>
          <dd className={`mt-1 font-semibold ${days <= 2 ? "text-red-600" : "text-zinc-950"}`}>
            {formatRfqDate(rfq.expiresAt)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-zinc-500">Customer</dt>
          <dd className="mt-1 truncate font-semibold text-zinc-950">{rfq.customer.name}</dd>
        </div>
      </dl>

      {myQuote ? (
        <p className="mt-3 text-sm font-semibold text-emerald-700">
          Your quote: {myQuote.status}
        </p>
      ) : null}
    </Link>
  );
}
