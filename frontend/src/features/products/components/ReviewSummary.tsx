import { AlertTriangle, MessageSquareText } from "lucide-react";

import { StarRating } from "@/features/products/components/StarRating";
import { formatProductDate } from "@/features/products/lib/product-display";
import type { ProductReview } from "@/features/products/model/product";

interface ReviewSummaryProps {
  averageRating: number | null;
  errorMessage: string | null;
  isLoading: boolean;
  onRetry: () => void;
  reviewCount: number;
  reviews: ProductReview[];
}

export function ReviewSummary({
  averageRating,
  errorMessage,
  isLoading,
  onRetry,
  reviewCount,
  reviews,
}: ReviewSummaryProps) {
  return (
    <section aria-labelledby="reviews-heading">
      <div className="grid gap-6 border-b border-zinc-200 pb-7 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center">
        <div>
          <p className="text-sm font-medium text-zinc-500">Average rating</p>
          <p className="mt-1 text-4xl font-semibold text-zinc-950">
            {averageRating === null ? "0.0" : averageRating.toFixed(1)}
          </p>
          <div className="mt-2">
            <StarRating rating={averageRating ?? 0} size="md" />
          </div>
        </div>
        <div>
          <h2
            className="text-xl font-semibold text-zinc-950"
            id="reviews-heading"
          >
            Customer reviews
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Based on {reviewCount.toLocaleString()}{" "}
            {reviewCount === 1 ? "verified review" : "verified reviews"}.
          </p>
        </div>
      </div>

      <div className="pt-7">
        <h3 className="text-base font-semibold text-zinc-950">
          Recent reviews
        </h3>

        {isLoading ? (
          <ReviewLoadingSkeleton />
        ) : errorMessage ? (
          <div className="mt-5 flex items-start gap-3 border-y border-red-200 py-5">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-red-700"
            />
            <div>
              <p className="text-sm font-semibold text-zinc-950">
                Reviews could not be loaded
              </p>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                {errorMessage}
              </p>
              <button
                className="mt-3 text-sm font-semibold text-emerald-700 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                onClick={onRetry}
                type="button"
              >
                Try again
              </button>
            </div>
          </div>
        ) : reviews.length === 0 ? (
          <div className="mt-5 flex items-center gap-3 border-y border-zinc-200 py-6 text-sm text-zinc-600">
            <MessageSquareText
              aria-hidden="true"
              className="size-5 shrink-0 text-zinc-400"
            />
            No reviews have been submitted for this product.
          </div>
        ) : (
          <div className="mt-5 divide-y divide-zinc-200 border-y border-zinc-200">
            {reviews.slice(0, 4).map((review) => (
              <article className="py-5" key={review.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-800"
                    >
                      {getInitials(review.customer.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-950">
                        {review.customer.name}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {formatProductDate(review.createdAt)}
                      </p>
                    </div>
                  </div>
                  <StarRating rating={review.rating} />
                </div>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-zinc-600">
                  {review.comment || "Rating submitted without a comment."}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ReviewLoadingSkeleton() {
  return (
    <div
      aria-label="Loading recent reviews"
      className="mt-5 animate-pulse divide-y divide-zinc-200 border-y border-zinc-200"
      role="status"
    >
      {Array.from({ length: 2 }, (_, index) => (
        <div className="py-5" key={index}>
          <div className="h-4 w-36 rounded bg-zinc-200" />
          <div className="mt-3 h-3 w-24 rounded bg-zinc-200" />
          <div className="mt-4 h-3 w-full rounded bg-zinc-200" />
          <div className="mt-2 h-3 w-4/5 rounded bg-zinc-200" />
        </div>
      ))}
    </div>
  );
}

function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "C"
  );
}
