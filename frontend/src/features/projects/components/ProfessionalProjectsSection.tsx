import { FolderKanban, LoaderCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { getPublishedProjects } from "@/features/projects/api/projects.api";
import { PublicProjectCard } from "@/features/projects/components/PublicProjectCard";
import { publicProjectsKey } from "@/features/projects/lib/project-queries";
import { getApiErrorMessage } from "@/shared/api/http-error";

interface ProfessionalProjectsSectionProps {
  /**
   * The User.id of the professional whose projects to show.
   * This is ProfessionalProfile.userId — NOT ProfessionalProfile.id.
   * The backend project filter uses Project.ownerId which references users.id.
   */
  ownerId: string;
}

const PREVIEW_LIMIT = 6;

export function ProfessionalProjectsSection({
  ownerId,
}: ProfessionalProjectsSectionProps) {
  const queryInput = { ownerId, limit: PREVIEW_LIMIT, page: 1 };

  const projectsQuery = useQuery({
    queryKey: publicProjectsKey(queryInput),
    queryFn: ({ signal }) => getPublishedProjects(queryInput, signal),
    staleTime: 30_000,
  });

  // No section at all while loading — avoids layout shift on the profile page.
  if (projectsQuery.isPending) {
    return (
      <section aria-label="Loading projects">
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          Loading projects…
        </div>
      </section>
    );
  }

  // Silent failure — a broken project section should not break the profile page.
  if (projectsQuery.isError) {
    return (
      <section aria-labelledby="projects-error-heading">
        <h2
          className="flex items-center gap-2 text-lg font-semibold text-zinc-950"
          id="projects-error-heading"
        >
          <FolderKanban
            aria-hidden="true"
            className="size-5 text-brand-ink"
          />
          Projects
        </h2>
        <p className="mt-3 text-sm text-zinc-500">
          {getApiErrorMessage(
            projectsQuery.error,
            "Projects could not be loaded.",
          )}
        </p>
      </section>
    );
  }

  // No published projects — render nothing so the profile isn't cluttered.
  if (projectsQuery.data.projects.length === 0) {
    return null;
  }

  const { projects, totalItems } = projectsQuery.data;
  const hasMore = totalItems > PREVIEW_LIMIT;

  return (
    <section aria-labelledby="projects-heading">
      <div className="flex items-center justify-between gap-4">
        <h2
          className="flex items-center gap-2 text-lg font-semibold text-zinc-950"
          id="projects-heading"
        >
          <FolderKanban
            aria-hidden="true"
            className="size-5 text-brand-ink"
          />
          Projects
          <span className="text-base font-normal text-zinc-400">
            ({totalItems})
          </span>
        </h2>
        {hasMore ? (
          <Link
            className="text-sm font-semibold text-brand-ink hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring"
            to={`/projects?ownerId=${encodeURIComponent(ownerId)}`}
          >
            View all
          </Link>
        ) : null}
      </div>

      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        {projects.map((project) => (
          <PublicProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  );
}
