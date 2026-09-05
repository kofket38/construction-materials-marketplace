import {
  AlertTriangle,
  Briefcase,
  Building2,
  CalendarDays,
  FolderKanban,
  Globe,
  ImageOff,
  Link2,
  LoaderCircle,
  MapPin,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { ProfessionalAvatar } from "@/features/professional-profile/components/ProfessionalAvatar";
import { getPublicProjectById } from "@/features/projects/api/projects.api";
import type { PublicOwnerDetailInfo } from "@/features/projects/api/projects.api";
import { publicProjectKey } from "@/features/projects/lib/project-queries";
import {
  formatBudget,
  formatDate,
} from "@/features/projects/lib/project-status";
import { getApiErrorMessage, getHttpStatus } from "@/shared/api/http-error";
import { FullPageStatus } from "@/shared/ui/FullPageStatus";

export function PublicProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const projectQuery = useQuery({
    queryKey: publicProjectKey(projectId ?? ""),
    enabled: Boolean(projectId),
    queryFn: ({ signal }) => {
      if (!projectId) throw new Error("A project ID is required.");
      return getPublicProjectById(projectId, signal);
    },
    retry: false,
    staleTime: 30_000,
  });

  if (!projectId) {
    return (
      <FullPageStatus
        description="No project ID was provided."
        icon={AlertTriangle}
        title="Project not found"
      />
    );
  }

  if (projectQuery.isPending) {
    return (
      <FullPageStatus
        description="Loading project details."
        icon={LoaderCircle}
        title="Loading project"
      />
    );
  }

  if (projectQuery.isError) {
    const status = getHttpStatus(projectQuery.error);

    if (status === 404) {
      return (
        <FullPageStatus
          description="This project does not exist or is not publicly available."
          icon={FolderKanban}
          title="Project not found"
        />
      );
    }

    return (
      <FullPageStatus
        action={{
          label: "Try again",
          onClick: () => void projectQuery.refetch(),
        }}
        description={getApiErrorMessage(
          projectQuery.error,
          "This project could not be loaded.",
        )}
        icon={AlertTriangle}
        title="Project unavailable"
      />
    );
  }

  const project = projectQuery.data;

  return (
    <main>
      {/* Header */}
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          {/* Back link */}
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-ink hover:text-brand-ink"
            to="/projects"
          >
            ← All Projects
          </Link>

          <div className="mt-5">
            {project.projectType ? (
              <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-ink">
                {project.projectType}
              </p>
            ) : null}
            <h1 className="text-3xl font-semibold text-zinc-950">
              {project.title}
            </h1>

            {/* Key meta */}
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-500">
              {project.location ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin aria-hidden="true" className="size-4 shrink-0" />
                  {project.location}
                </span>
              ) : null}
              {project.budget ? (
                <span className="inline-flex items-center gap-1.5">
                  <Wallet aria-hidden="true" className="size-4 shrink-0" />
                  {formatBudget(project.budget)}
                </span>
              ) : null}
              {project.startDate || project.endDate ? (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
                  {project.startDate ? formatDate(project.startDate) : "—"}
                  {" – "}
                  {project.endDate ? formatDate(project.endDate) : "ongoing"}
                </span>
              ) : null}
              {project.publishedAt ? (
                <span className="text-xs text-zinc-400">
                  Published {formatDate(project.publishedAt)}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          {/* Main column */}
          <div className="space-y-8">
            {/* Image gallery */}
            {project.images.length > 0 ? (
              <section aria-label="Project images">
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {project.images.map((src, i) => (
                    <ImageTile key={i} src={src} />
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Description */}
            {project.description ? (
              <section aria-labelledby="description-heading">
                <h2
                  className="text-lg font-semibold text-zinc-950"
                  id="description-heading"
                >
                  About this project
                </h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-700">
                  {project.description}
                </p>
              </section>
            ) : null}
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* Owner card */}
            {project.owner ? (
              <OwnerCard owner={project.owner} />
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}

// ── Image tile ────────────────────────────────────────────────────────────────

function ImageTile({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <li className="aspect-video overflow-hidden rounded-md border border-zinc-200 bg-zinc-100">
      {!failed ? (
        <img
          alt=""
          className="size-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
          src={src}
        />
      ) : (
        <span className="flex size-full items-center justify-center text-zinc-400">
          <ImageOff aria-hidden="true" className="size-6" strokeWidth={1.5} />
        </span>
      )}
    </li>
  );
}

// ── Owner card ────────────────────────────────────────────────────────────────

function OwnerCard({ owner }: { owner: PublicOwnerDetailInfo }) {
  const locationParts = [owner.city, owner.region, owner.country].filter(Boolean);

  return (
    <section
      aria-labelledby="owner-heading"
      className="rounded-md border border-zinc-200 bg-white shadow-sm"
    >
      <div className="p-4">
        <p
          className="text-xs font-semibold uppercase text-zinc-500"
          id="owner-heading"
        >
          Professional
        </p>

        {/* Avatar + name */}
        <div className="mt-3 flex items-start gap-3">
          <span className="size-12 shrink-0 overflow-hidden rounded-full">
            <ProfessionalAvatar
              initialsClassName="text-base"
              name={owner.displayName}
              src={owner.avatarUrl}
            />
          </span>
          <div className="min-w-0">
            <Link
              className="block truncate font-semibold text-zinc-950 hover:text-brand-ink"
              to={`/professionals/${encodeURIComponent(owner.profileId)}`}
            >
              {owner.displayName}
            </Link>
            {owner.headline ? (
              <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">
                {owner.headline}
              </p>
            ) : null}
          </div>
        </div>

        {/* Professional details */}
        <dl className="mt-4 space-y-2 text-sm">
          {owner.profession ? (
            <div className="flex items-center gap-2 text-zinc-600">
              <Briefcase aria-hidden="true" className="size-4 shrink-0 text-zinc-400" />
              <span>
                {owner.profession}
                {owner.yearsExperience
                  ? ` · ${owner.yearsExperience} yrs`
                  : ""}
              </span>
            </div>
          ) : null}
          {owner.company ? (
            <div className="flex items-center gap-2 text-zinc-600">
              <Building2 aria-hidden="true" className="size-4 shrink-0 text-zinc-400" />
              <span>{owner.company}</span>
            </div>
          ) : null}
          {locationParts.length > 0 ? (
            <div className="flex items-center gap-2 text-zinc-600">
              <MapPin aria-hidden="true" className="size-4 shrink-0 text-zinc-400" />
              <span>{locationParts.join(", ")}</span>
            </div>
          ) : null}
          {owner.website ? (
            <div className="flex items-center gap-2">
              <Globe aria-hidden="true" className="size-4 shrink-0 text-zinc-400" />
              <a
                className="truncate text-brand-ink hover:text-brand-ink"
                href={owner.website}
                rel="noopener noreferrer"
                target="_blank"
              >
                Website
              </a>
            </div>
          ) : null}
          {owner.linkedinUrl ? (
            <div className="flex items-center gap-2">
              <Link2 aria-hidden="true" className="size-4 shrink-0 text-zinc-400" />
              <a
                className="truncate text-brand-ink hover:text-brand-ink"
                href={owner.linkedinUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                LinkedIn
              </a>
            </div>
          ) : null}
        </dl>

        {/* Specialties */}
        {owner.specialties.length > 0 ? (
          <div className="mt-4 border-t border-zinc-100 pt-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-zinc-500">
              <Sparkles aria-hidden="true" className="size-3.5" />
              Specialties
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {owner.specialties.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-brand-line bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-ink"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {/* View profile CTA */}
        <Link
          className="mt-4 inline-flex w-full min-h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring"
          to={`/professionals/${encodeURIComponent(owner.profileId)}`}
        >
          View profile
        </Link>
      </div>
    </section>
  );
}
