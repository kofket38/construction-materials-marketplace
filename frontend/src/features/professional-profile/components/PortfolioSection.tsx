import {
  AlertTriangle,
  CalendarDays,
  Images,
  ImageOff,
  LoaderCircle,
  MapPin,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import {
  listProfessionalPortfolio,
  type PortfolioItem,
} from "@/features/professional-profile/api/professional-profile.api";
import { getApiErrorMessage } from "@/shared/api/http-error";

// ── Public portfolio display ──────────────────────────────────────────────────

export function PortfolioSection({ profileId }: { profileId: string }) {
  const portfolioQuery = useQuery({
    queryKey: ["professional-profile", "public", profileId, "portfolio"],
    queryFn: ({ signal }) => listProfessionalPortfolio(profileId, signal),
    staleTime: 30_000,
    retry: false,
  });

  return (
    <section aria-labelledby="portfolio-heading">
      <h2
        className="flex items-center gap-2 text-lg font-semibold text-zinc-950"
        id="portfolio-heading"
      >
        <Images aria-hidden="true" className="size-5 text-brand-ink" />
        Portfolio
      </h2>

      {portfolioQuery.isPending ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-zinc-500">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          Loading portfolio.
        </p>
      ) : null}

      {portfolioQuery.isError ? (
        <div className="mt-4 flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="flex items-start gap-2">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {getApiErrorMessage(
              portfolioQuery.error,
              "Could not load this portfolio.",
            )}
          </span>
          <button
            className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline"
            onClick={() => void portfolioQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}

      {portfolioQuery.isSuccess && portfolioQuery.data.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          No portfolio projects added yet.
        </p>
      ) : null}

      {portfolioQuery.isSuccess && portfolioQuery.data.length > 0 ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {portfolioQuery.data.map((item) => (
            <PortfolioCard key={item.id} item={item} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

// ── Item card ────────────────────────────────────────────────────────────────

function PortfolioCard({ item }: { item: PortfolioItem }) {
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const availableImages = item.images.filter((url) => !failedImages.has(url));
  const [selectedImage, setSelectedImage] = useState<string | null>(
    availableImages[0] ?? null,
  );
  const activeImage =
    selectedImage && availableImages.includes(selectedImage)
      ? selectedImage
      : (availableImages[0] ?? null);

  function markFailed(url: string): void {
    setFailedImages((current) => {
      const next = new Set(current);
      next.add(url);
      return next;
    });
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white">
      {/* Cover image */}
      <div className="aspect-[16/10] shrink-0 overflow-hidden border-b border-zinc-200 bg-zinc-100">
        {activeImage ? (
          <img
            alt={`${item.title} project photo`}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => markFailed(activeImage)}
            referrerPolicy="no-referrer"
            src={activeImage}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-400">
            <ImageOff aria-hidden="true" className="size-10" strokeWidth={1.25} />
            <span className="text-xs font-semibold uppercase">No photo</span>
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {availableImages.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto px-3 pt-3" role="group" aria-label={`${item.title} photos`}>
          {availableImages.map((url, index) => (
            <button
              aria-label={`View ${item.title} photo ${index + 1}`}
              aria-pressed={url === activeImage}
              className={`aspect-square size-12 shrink-0 overflow-hidden rounded-md border bg-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring ${
                url === activeImage
                  ? "border-brand ring-1 ring-brand-ring"
                  : "border-zinc-200 hover:border-zinc-400"
              }`}
              key={url}
              onClick={() => setSelectedImage(url)}
              type="button"
            >
              <img
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                onError={() => markFailed(url)}
                referrerPolicy="no-referrer"
                src={url}
              />
            </button>
          ))}
        </div>
      ) : null}

      {/* Content */}
      <div className="flex min-w-0 grow flex-col p-4">
        <div className="flex flex-wrap items-center gap-2">
          {item.projectType ? (
            <span className="rounded-full border border-brand-line bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-ink">
              {item.projectType}
            </span>
          ) : null}
          {item.completionDate ? (
            <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
              <CalendarDays aria-hidden="true" className="size-3.5" />
              Completed {formatCompletionDate(item.completionDate)}
            </span>
          ) : null}
        </div>

        <h3 className="mt-1.5 font-semibold text-zinc-950">{item.title}</h3>

        {item.location ? (
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-zinc-500">
            <MapPin aria-hidden="true" className="size-3.5" />
            {item.location}
          </p>
        ) : null}

        {item.description ? (
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {item.description}
          </p>
        ) : null}
      </div>
    </article>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Formats an ISO date string in UTC so date-only values never shift days. */
function formatCompletionDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
