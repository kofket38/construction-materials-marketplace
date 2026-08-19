import {
  AlertTriangle,
  BadgeCheck,
  LoaderCircle,
  MessageSquareText,
  Star,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  submitReview,
} from "@/features/products/api/product-actions.api";
import { StarRating } from "@/features/products/components/StarRating";
import { formatProductDate } from "@/features/products/lib/product-display";
import type { ProductReview } from "@/features/products/model/product";
import { useAuthStore } from "@/features/auth/model/auth.store";
import {
  getApiErrorMessage,
  getHttpStatus,
} from "@/shared/api/http-error";

interface ReviewSummaryProps {
  averageRating: number | null;
  errorMessage: string | null;
  isLoading: boolean;
  onRetry: () => void;
  productId: string;
  reviewCount: number;
  reviews: ProductReview[];
}

export function ReviewSummary({
  averageRating,
  errorMessage,
  isLoading,
  onRetry,
  productId,
  reviewCount,
  reviews,
}: ReviewSummaryProps) {
  const user = useAuthStore((state) => state.user);
  const authStatus = useAuthStore((state) => state.status);
  const queryClient = useQueryClient();
  const isCustomer = authStatus === "authenticated" && user?.role === "CUSTOMER";

  // Check whether this customer has already reviewed.
  const hasReviewed = Boolean(
    user &&
      reviews.some((r) => r.customerId === user.id),
  );

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

      {/* ── Review submission form ─────────────────────────────────────── */}
      {isCustomer && !hasReviewed ? (
        <div className="border-b border-zinc-200 py-7">
          <ReviewForm
            productId={productId}
            onSuccess={() => {
              void queryClient.invalidateQueries({
                queryKey: ["products", "reviews", productId],
              });
              void queryClient.invalidateQueries({
                queryKey: ["products", "details", productId],
              });
            }}
          />
        </div>
      ) : isCustomer && hasReviewed ? (
        <div className="flex items-center gap-2 border-b border-zinc-200 py-5 text-sm text-emerald-700">
          <BadgeCheck aria-hidden="true" className="size-4 shrink-0" />
          You have already reviewed this product.
        </div>
      ) : null}

      {/* ── Review list ────────────────────────────────────────────────── */}
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

// ── Submission form ────────────────────────────────────────────────────────────

function ReviewForm({
  onSuccess,
  productId,
}: {
  onSuccess: () => void;
  productId: string;
}) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const reviewMutation = useMutation({
    mutationFn: () =>
      submitReview(productId, {
        rating,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      }),
    onSuccess: () => {
      setSubmitted(true);
      onSuccess();
    },
  });

  if (submitted && reviewMutation.isSuccess) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-700">
        <BadgeCheck aria-hidden="true" className="size-4 shrink-0" />
        Your review has been submitted. Thank you!
      </div>
    );
  }

  const displayRating = hoverRating || rating;
  const ratingLabels: Record<number, string> = {
    1: "Poor",
    2: "Fair",
    3: "Good",
    4: "Very good",
    5: "Excellent",
  };

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    if (rating === 0) return;
    reviewMutation.mutate();
  }

  const isEligibilityError =
    reviewMutation.isError && getHttpStatus(reviewMutation.error) === 403;

  return (
    <div>
      <h3 className="text-base font-semibold text-zinc-950">
        Write a review
      </h3>
      <p className="mt-1 text-sm text-zinc-500">
        Share your experience with this product.
      </p>

      <form className="mt-4 space-y-4" noValidate onSubmit={handleSubmit}>
        {/* Star rating picker */}
        <div>
          <p className="text-sm font-medium text-zinc-800">
            Your rating
            <span aria-hidden="true" className="ml-0.5 text-red-600">*</span>
          </p>
          <div
            className="mt-2 flex gap-1"
            role="group"
            aria-label="Select a rating from 1 to 5 stars"
          >
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                aria-label={`${star} star${star > 1 ? "s" : ""}`}
                className="rounded p-0.5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-700 disabled:opacity-60"
                disabled={reviewMutation.isPending}
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                type="button"
              >
                <Star
                  aria-hidden="true"
                  className={`size-7 transition-colors ${
                    star <= displayRating
                      ? "fill-amber-400 text-amber-500"
                      : "fill-zinc-200 text-zinc-300"
                  }`}
                />
              </button>
            ))}
            {displayRating > 0 ? (
              <span className="ml-2 self-center text-sm font-medium text-zinc-600">
                {ratingLabels[displayRating]}
              </span>
            ) : null}
          </div>
          {rating === 0 && reviewMutation.isError && !isEligibilityError ? (
            <p className="mt-1 text-xs text-red-700" role="alert">
              Please select a star rating.
            </p>
          ) : null}
        </div>

        {/* Comment */}
        <div>
          <label className="text-sm font-medium text-zinc-800" htmlFor="review-comment">
            Comment{" "}
            <span className="font-normal text-zinc-500">(optional)</span>
          </label>
          <textarea
            className="mt-1.5 min-h-24 w-full max-w-xl resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 disabled:opacity-60"
            disabled={reviewMutation.isPending}
            id="review-comment"
            maxLength={5000}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What did you think of this product?"
            value={comment}
          />
        </div>

        {/* Error state */}
        {reviewMutation.isError ? (
          <div
            className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800"
            role="alert"
          >
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {isEligibilityError
              ? "You can only review products from your delivered orders."
              : getApiErrorMessage(
                  reviewMutation.error,
                  "Your review could not be submitted. Please try again.",
                )}
          </div>
        ) : null}

        {/* Submit */}
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={reviewMutation.isPending || rating === 0}
          type="submit"
        >
          {reviewMutation.isPending ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : null}
          {reviewMutation.isPending ? "Submitting…" : "Submit review"}
        </button>
      </form>
    </div>
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
