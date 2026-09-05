import { Briefcase, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

import type { ProfessionalDirectoryItem } from "@/features/professional-profile/api/professional-profile.api";
import { ProfessionalAvatar } from "@/features/professional-profile/components/ProfessionalAvatar";

// ── Professional directory card ───────────────────────────────────────────────

export function ProfessionalCard({
  professional,
}: {
  professional: ProfessionalDirectoryItem;
}) {
  const location = [professional.city, professional.region, professional.country]
    .filter(Boolean)
    .join(", ");

  return (
    <article className="flex min-h-full flex-col rounded-md border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <span className="block size-12 shrink-0 overflow-hidden rounded-full">
          <ProfessionalAvatar
            name={professional.displayName}
            src={professional.avatarUrl}
          />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-zinc-950">
            {professional.displayName}
          </h2>
          {professional.headline ? (
            <p className="mt-1 truncate text-sm text-zinc-600">
              {professional.headline}
            </p>
          ) : null}
        </div>
      </div>

      <dl className="mt-5 space-y-2 border-y border-zinc-200 py-4 text-sm">
        {professional.profession ? (
          <div className="flex items-center gap-1.5 text-zinc-600">
            <Briefcase aria-hidden="true" className="size-4 shrink-0" />
            <dt className="sr-only">Profession</dt>
            <dd className="min-w-0 truncate">
              {professional.profession}
              {professional.yearsExperience !== null
                ? ` · ${professional.yearsExperience} yrs`
                : ""}
            </dd>
          </div>
        ) : null}
        {location ? (
          <div className="flex items-center gap-1.5 text-zinc-600">
            <MapPin aria-hidden="true" className="size-4 shrink-0" />
            <dt className="sr-only">Location</dt>
            <dd className="min-w-0 truncate">{location}</dd>
          </div>
        ) : null}
      </dl>

      {professional.specialties.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {professional.specialties.map((specialty) => (
            <span
              className="rounded-full border border-brand-line bg-brand-soft px-3 py-1 text-xs font-medium text-brand-ink"
              key={specialty}
            >
              {specialty}
            </span>
          ))}
        </div>
      ) : null}

      <div className="grow" />

      <Link
        className="mt-5 inline-flex min-h-10 items-center justify-center rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
        to={`/professionals/${encodeURIComponent(professional.id)}`}
      >
        View Profile
      </Link>
    </article>
  );
}
