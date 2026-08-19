import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LoaderCircle,
  Plus,
} from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { useAuthStore } from "@/features/auth/model/auth.store";
import { getMyRfqs } from "@/features/rfq/api/rfq.api";
import {
  formatRfqDate,
  formatRfqStatus,
  rfqStatusColor,
} from "@/features/rfq/lib/rfq-display";
import type { RequestForQuote, RfqStatus } from "@/features/rfq/model/rfq";
import { getApiErrorMessage } from "@/shared/api/http-error";
import { FullPageStatus } from "@/shared/ui/FullPageStatus";

const PAGE_SIZE = 20;

const statusOptions: Array<{ label: string; value: RfqStatus | "" }> = [
  { label: "All statuses", value: "" },
  { label: "Open", value: "OPEN" },
  { label: "Awarded", value: "AWARDED" },
  { label: "Expired", value: "EXPIRED" },
  { label: "Cancelled", value: "CANCELLED" },
];

export function MyRfqsPage() {
  const authStatus = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<RfqStatus | "">("");

  const rfqsQuery = useQuery({
    queryKey: ["rfqs", "mine", { page, status }],
    enabled: authStatus === "authenticated" && user?.role === "CUSTOMER",
    queryFn: ({ signal }) =>
      getMyRfqs({ page, limit: PAGE_SIZE, ...(status ? { status } : {}) }, signal),
    placeholderData: keepPreviousData,
  });

  if (authStatus !== "authenticated" || !user) {
    return <Navigate replace state={{ returnTo: "/rfqs" }} to="/login" />;
  }
  if (user.role !== "CUSTOMER") {
    return <Navigate replace to="/products" />;
  }
  if (rfqsQuery.isPending) {
    return (
      <FullPageStatus
        description="Loading your requests for quotation."
        icon={LoaderCircle}
        title="Loading RFQs"
      />
    );
  }
  if (rfqsQuery.isError) {
    return (
      <FullPageStatus
        action={{ label: "Try again", onClick: () => void rfqsQuery.refetch() }}
        description={getApiErrorMessage(rfqsQuery.error, "Requests for quotation could not be loaded.")}
        icon={AlertTriangle}
        title="RFQs unavailable"
      />
    );
  }

  const { rfqs, pagination } = rfqsQuery.data!;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Account</p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">
            Requests for Quotation
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Request quotes from suppliers for bulk or custom material needs.
          </p>
        </div>
        <Link
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          to="/rfqs/new"
        >
          <Plus aria-hidden="true" className="size-4" />
          New RFQ
        </Link>
      </div>

      {/* Status filter */}
      <div className="mt-5 flex flex-wrap gap-2 border-b border-zinc-200 pb-4">
        {statusOptions.map((option) => (
          <button
            className={`inline-flex min-h-9 items-center rounded-full border px-3 py-1 text-sm font-semibold transition-colors ${
              status === option.value
                ? "border-emerald-700 bg-emerald-700 text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
            key={option.value}
            onClick={() => {
              setStatus(option.value);
              setPage(1);
            }}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* List */}
      {rfqs.length === 0 ? (
        <section className="py-16 text-center">
          <ClipboardList
            aria-hidden="true"
            className="mx-auto size-8 text-zinc-400"
          />
          <h2 className="mt-4 text-lg font-semibold text-zinc-950">
            No requests yet
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Create an RFQ to request quotes from multiple suppliers.
          </p>
          <Link
            className="mt-6 inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            to="/rfqs/new"
          >
            <Plus aria-hidden="true" className="size-4" />
            Create RFQ
          </Link>
        </section>
      ) : (
        <div className="mt-5 space-y-3">
          {rfqs.map((rfq) => (
            <RfqCard key={rfq.id} rfq={rfq} />
          ))}
        </div>
      )}

      {/* Pagination */}
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

function RfqCard({ rfq }: { rfq: RequestForQuote }) {
  const hasAward = rfq.awardedQuoteId !== null;

  return (
    <Link
      className="group block rounded-md border border-zinc-200 bg-white p-5 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
      to={`/rfqs/${rfq.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate font-semibold text-zinc-950">{rfq.title}</h2>
          <p className="mt-1 text-sm text-zinc-500">{rfq.deliveryLocation}</p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${rfqStatusColor(rfq.status)}`}
        >
          {formatRfqStatus(rfq.status)}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-zinc-200 pt-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs font-medium uppercase text-zinc-500">Items</dt>
          <dd className="mt-1 font-semibold text-zinc-950">{rfq.items.length}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-zinc-500">Quotes</dt>
          <dd className="mt-1 font-semibold text-zinc-950">
            {rfq.quotes.length}{hasAward ? " (awarded)" : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-zinc-500">Created</dt>
          <dd className="mt-1 font-semibold text-zinc-950">
            {formatRfqDate(rfq.createdAt)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-zinc-500">Expires</dt>
          <dd className="mt-1 font-semibold text-zinc-950">
            {formatRfqDate(rfq.expiresAt)}
          </dd>
        </div>
      </dl>

      {hasAward ? (
        <p className="mt-3 text-sm font-semibold text-emerald-700">
          ✓ Quote accepted — order created
        </p>
      ) : null}
    </Link>
  );
}
