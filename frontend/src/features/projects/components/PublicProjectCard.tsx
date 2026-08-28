import { CalendarDays, ImageOff, MapPin, Wallet } from "lucide-react";
import { Link } from "react-router-dom";

import { ProfessionalAvatar } from "@/features/professional-profile/components/ProfessionalAvatar";
import type {
  PublicOwnerInfo,
  PublicProjectItem,
} from "@/features/projects/api/projects.api";
import { formatBudget, formatDate } from "@/features/projects/lib/project-status";

interface PublicProjectCardProps {
  project: PublicProjectItem;
}

export function PublicProjectCard({ project }: PublicProjectCardProps) {
  const thumbnail = project.images[0];

  return (
    <Link
      className="group flex flex-col overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm transition-colors hover:border-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
      to={`/projects/${encodeURIComponent(project.id)}`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-zinc-100">
        {thumbnail ? (
          <img
            alt=""
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
              const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (fallback) fallback.style.display = "flex";
            }}
            src={thumbnail}
          />
        ) : null}
        {/* Fallback shown when no image or image fails to load */}
        <span
          className="absolute inset-0 flex items-center justify-center text-zinc-400"
          style={{ display: thumbnail ? "none" : "flex" }}
        >
          <ImageOff aria-hidden="true" className="size-8" strokeWidth={1.5} />
        </span>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Title + type */}
        <div>
          {project.projectType ? (
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              {project.projectType}
            </p>
          ) : null}
          <h3 className="line-clamp-2 text-sm font-semibold text-zinc-950 group-hover:text-emerald-800">
            {project.title}
          </h3>
          {project.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
              {project.description}
            </p>
          ) : null}
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
          {project.location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
              {project.location}
            </span>
          ) : null}
          {project.budget ? (
            <span className="inline-flex items-center gap-1">
              <Wallet aria-hidden="true" className="size-3.5 shrink-0" />
              {formatBudget(project.budget)}
            </span>
          ) : null}
          {project.publishedAt ? (
            <span className="inline-flex items-center gap-1">
              <CalendarDays aria-hidden="true" className="size-3.5 shrink-0" />
              {formatDate(project.publishedAt)}
            </span>
          ) : null}
        </div>

        {/* Owner attribution */}
        {project.owner ? (
          <OwnerAttribution owner={project.owner} />
        ) : null}
      </div>
    </Link>
  );
}

// ── Owner attribution sub-component ──────────────────────────────────────────

function OwnerAttribution({ owner }: { owner: PublicOwnerInfo }) {
  const location = [owner.city, owner.country].filter(Boolean).join(", ");

  return (
    <div
      className="mt-auto flex items-center gap-2.5 border-t border-zinc-100 pt-3"
      onClick={(e) => {
        // Prevent the card Link from capturing these clicks — let them bubble
        // to the owner link below instead.
        e.stopPropagation();
      }}
    >
      <span className="size-8 shrink-0 overflow-hidden rounded-full">
        <ProfessionalAvatar
          initialsClassName="text-xs"
          name={owner.displayName}
          src={owner.avatarUrl}
        />
      </span>
      <div className="min-w-0 flex-1">
        <Link
          className="block truncate text-xs font-semibold text-zinc-800 hover:text-emerald-700"
          onClick={(e) => e.stopPropagation()}
          to={`/professionals/${encodeURIComponent(owner.profileId)}`}
        >
          {owner.displayName}
        </Link>
        <p className="truncate text-xs text-zinc-500">
          {owner.profession ?? owner.headline ?? location}
        </p>
      </div>
    </div>
  );
}
