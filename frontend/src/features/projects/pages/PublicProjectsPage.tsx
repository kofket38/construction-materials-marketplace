import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  FolderKanban,
  LoaderCircle,
  Search,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

import { getPublishedProjects } from "@/features/projects/api/projects.api";
import { publicProjectsKey } from "@/features/projects/lib/project-queries";
import { PublicProjectCard } from "@/features/projects/components/PublicProjectCard";
import { getApiErrorMessage } from "@/shared/api/http-error";

const PAGE_SIZE = 20;

export function PublicProjectsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search")?.trim() ?? "";
  const projectType = searchParams.get("projectType")?.trim() ?? "";
  const location = searchParams.get("location")?.trim() ?? "";
  // ownerId is passed in from professional profile pages — not shown as a
  // form filter, but respected when present in the URL.
  const ownerId = searchParams.get("ownerId")?.trim() ?? "";
  const page = parsePage(searchParams.get("page"));

  const queryInput = {
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    projectType: projectType || undefined,
    location: location || undefined,
    ownerId: ownerId || undefined,
  };

  const projectsQuery = useQuery({
    queryKey: publicProjectsKey(queryInput),
    queryFn: ({ signal }) => getPublishedProjects(queryInput, signal),
    placeholderData: keepPreviousData,
  });

  function updateSearchParams(
    updates: Record<string, string | undefined>,
  ): void {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }
    setSearchParams(next);
  }

  function handleSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    updateSearchParams({
      location: fd.get("location")?.toString().trim() || undefined,
      page: undefined,
      projectType: fd.get("projectType")?.toString().trim() || undefined,
      search: fd.get("search")?.toString().trim() || undefined,
    });
  }

  function clearFilters(): void {
    // Preserve ownerId if present (e.g. linked from a professional profile).
    const next: Record<string, string | undefined> = {
      location: undefined,
      page: undefined,
      projectType: undefined,
      search: undefined,
    };
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(next)) {
        if (v === undefined) params.delete(k);
        else params.set(k, v);
      }
      return params;
    });
  }

  const hasActiveFilters =
    Boolean(search) || Boolean(projectType) || Boolean(location);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-brand-ink">
            Project marketplace
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">
            Projects
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            Discover published construction projects from professionals across
            the marketplace.
          </p>
        </div>
        {projectsQuery.data ? (
          <p aria-live="polite" className="text-sm font-medium text-zinc-600">
            {projectsQuery.data.totalItems.toLocaleString()}{" "}
            {projectsQuery.data.totalItems === 1 ? "project" : "projects"}
          </p>
        ) : null}
      </div>

      {/* Search / filter bar */}
      <form
        className="mt-8 grid gap-3 border-y border-zinc-200 py-4 md:grid-cols-[minmax(14rem,1fr)_minmax(9rem,1fr)_minmax(9rem,1fr)_auto]"
        onSubmit={handleSearch}
        role="search"
      >
        <label className="relative block">
          <span className="sr-only">Search projects</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
          />
          <input
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white py-2 pl-10 pr-3 text-sm text-zinc-950 outline-none transition-colors placeholder:text-zinc-400 focus:border-brand focus:ring-2 focus:ring-brand-ring/15"
            defaultValue={search}
            key={search}
            name="search"
            placeholder="Title, description, or location"
            type="search"
          />
        </label>

        <label>
          <span className="sr-only">Project type</span>
          <input
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition-colors placeholder:text-zinc-400 focus:border-brand focus:ring-2 focus:ring-brand-ring/15"
            defaultValue={projectType}
            key={projectType}
            name="projectType"
            placeholder="Project type"
            type="text"
          />
        </label>

        <label>
          <span className="sr-only">Location</span>
          <input
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition-colors placeholder:text-zinc-400 focus:border-brand focus:ring-2 focus:ring-brand-ring/15"
            defaultValue={location}
            key={location}
            name="location"
            placeholder="Location"
            type="text"
          />
        </label>

        <div className="flex gap-2">
          <button
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 md:flex-none"
            type="submit"
          >
            <Search aria-hidden="true" className="size-4" />
            Search
          </button>
          {hasActiveFilters ? (
            <button
              aria-label="Clear project filters"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
              onClick={clearFilters}
              title="Clear filters"
              type="button"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          ) : null}
        </div>
      </form>

      {/* Results */}
      {projectsQuery.isPending ? (
        <ProjectsStatus>
          <LoaderCircle
            aria-hidden="true"
            className="size-6 animate-spin text-brand-ink"
          />
          <p>Loading projects...</p>
        </ProjectsStatus>
      ) : projectsQuery.isError ? (
        <ProjectsStatus>
          <FolderKanban
            aria-hidden="true"
            className="size-9 text-red-700"
            strokeWidth={1.6}
          />
          <div className="text-center">
            <h2 className="font-semibold text-zinc-950">
              Unable to load projects
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-zinc-600">
              {getApiErrorMessage(
                projectsQuery.error,
                "The project directory could not be loaded. Please try again.",
              )}
            </p>
          </div>
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
            onClick={() => void projectsQuery.refetch()}
            type="button"
          >
            Try again
          </button>
        </ProjectsStatus>
      ) : projectsQuery.data.totalPages > 0 &&
        projectsQuery.data.currentPage > projectsQuery.data.totalPages ? (
        <ProjectsStatus>
          <FolderKanban
            aria-hidden="true"
            className="size-9 text-brand-ink"
            strokeWidth={1.6}
          />
          <div className="text-center">
            <h2 className="font-semibold text-zinc-950">
              This page is out of range
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              Page {projectsQuery.data.currentPage} does not exist. There{" "}
              {projectsQuery.data.totalPages === 1 ? "is" : "are"}{" "}
              {projectsQuery.data.totalPages}{" "}
              {projectsQuery.data.totalPages === 1 ? "page" : "pages"}.
            </p>
          </div>
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100"
            onClick={() => updateSearchParams({ page: undefined })}
            type="button"
          >
            Return to page 1
          </button>
        </ProjectsStatus>
      ) : projectsQuery.data.projects.length === 0 ? (
        <ProjectsStatus>
          <FolderKanban
            aria-hidden="true"
            className="size-9 text-brand-ink"
            strokeWidth={1.6}
          />
          <div className="text-center">
            {hasActiveFilters ? (
              <>
                <h2 className="font-semibold text-zinc-950">
                  No projects match your search
                </h2>
                <p className="mt-2 text-sm text-zinc-600">
                  Try a different title, project type, or location.
                </p>
              </>
            ) : (
              <>
                <h2 className="font-semibold text-zinc-950">
                  No published projects yet
                </h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-zinc-600">
                  Published projects will appear here once professionals
                  complete and publish their work.
                </p>
              </>
            )}
          </div>
          {hasActiveFilters ? (
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100"
              onClick={clearFilters}
              type="button"
            >
              Clear filters
            </button>
          ) : null}
        </ProjectsStatus>
      ) : (
        <>
          <div
            aria-busy={projectsQuery.isFetching}
            className={`mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${
              projectsQuery.isFetching ? "opacity-60" : ""
            }`}
          >
            {projectsQuery.data.projects.map((project) => (
              <PublicProjectCard key={project.id} project={project} />
            ))}
          </div>

          {projectsQuery.data.totalPages > 1 ? (
            <nav
              aria-label="Project directory pagination"
              className="mt-8 flex items-center justify-between border-t border-zinc-200 pt-5"
            >
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!projectsQuery.data.hasPreviousPage}
                onClick={() =>
                  updateSearchParams({
                    page: page > 2 ? String(page - 1) : undefined,
                  })
                }
                type="button"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                Previous
              </button>
              <p className="text-sm text-zinc-600">
                Page{" "}
                <span className="font-semibold text-zinc-950">
                  {projectsQuery.data.currentPage}
                </span>{" "}
                of {projectsQuery.data.totalPages}
              </p>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!projectsQuery.data.hasNextPage}
                onClick={() =>
                  updateSearchParams({ page: String(page + 1) })
                }
                type="button"
              >
                Next
                <ArrowRight aria-hidden="true" className="size-4" />
              </button>
            </nav>
          ) : null}
        </>
      )}
    </main>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

function ProjectsStatus({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-live="polite"
      className="flex min-h-80 flex-col items-center justify-center gap-4 py-12 text-sm font-medium text-zinc-600"
    >
      {children}
    </section>
  );
}

// ── Utility ───────────────────────────────────────────────────────────────────

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}
