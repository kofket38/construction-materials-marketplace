import {
  AlertTriangle,
  CalendarDays,
  FolderKanban,
  Images,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import {
  deleteProject,
  getMyProjects,
  reorderProjects,
  type Project,
} from "@/features/projects/api/projects.api";
import { ProjectStatusActions, ProjectStatusBadge } from "@/features/projects/components/ProjectStatusControls";
import {
  formatBudget,
  formatDate,
} from "@/features/projects/lib/project-status";
import {
  MY_PROJECTS_KEY,
  useInvalidateProjects,
} from "@/features/projects/lib/project-queries";
import { getApiErrorMessage } from "@/shared/api/http-error";
import { EmptyState } from "@/shared/layouts/dashboard";

// ── Page ──────────────────────────────────────────────────────────────────────

export function MyProjectsPage() {
  // Route protection (authentication) is handled by RequireAuth in the router.
  return <MyProjectsContent />;
}

function MyProjectsContent() {
  const projectsQuery = useQuery({
    queryKey: MY_PROJECTS_KEY,
    queryFn: ({ signal }) => getMyProjects(signal),
    staleTime: 30_000,
  });

  if (projectsQuery.isPending) {
    return (
      <PageShell>
        <PageHeader />
        <div className="mt-8">
          <ListSkeleton />
        </div>
      </PageShell>
    );
  }

  if (projectsQuery.isError) {
    return (
      <PageShell>
        <PageHeader />
        <div className="mt-8 flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="flex items-start gap-2">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {getApiErrorMessage(
              projectsQuery.error,
              "Could not load your projects.",
            )}
          </span>
          <button
            className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline"
            onClick={() => void projectsQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        </div>
      </PageShell>
    );
  }

  const projects = projectsQuery.data;

  return (
    <PageShell>
      <PageHeader projectCount={projects.length} />

      {projects.length === 0 ? (
        <div className="mt-8 rounded-md border border-dashed border-zinc-300 bg-white">
          <EmptyState
            action={{
              href: "/professional/projects/new",
              label: "Create your first project",
            }}
            description="Track construction work you are planning, running, or have completed — all in one place."
            icon={FolderKanban}
            title="No projects yet"
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {projects.map((project, index) => (
            <ProjectCard
              index={index}
              isFirst={index === 0}
              isLast={index === projects.length - 1}
              key={project.id}
              orderedIds={projects.map((p) => p.id)}
              project={project}
            />
          ))}
        </ul>
      )}
    </PageShell>
  );
}

// ── Shell helpers ─────────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      {children}
    </main>
  );
}

function PageHeader({ projectCount }: { projectCount?: number }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
      <div>
        <p className="text-sm font-semibold text-emerald-700">
          Professional workspace
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-950 sm:text-3xl">
          My Projects
        </h1>
        {projectCount !== undefined ? (
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {projectCount.toLocaleString()} project
            {projectCount !== 1 ? "s" : ""}, ordered by display order.
          </p>
        ) : null}
      </div>
      <Link
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        to="/professional/projects/new"
      >
        <Plus aria-hidden="true" className="size-4" />
        Create Project
      </Link>
    </div>
  );
}

function ListSkeleton() {
  return (
    <p className="inline-flex items-center gap-2 text-sm text-zinc-500">
      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      Loading your projects.
    </p>
  );
}

// ── Project card ──────────────────────────────────────────────────────────────

function ProjectCard({
  index,
  isFirst,
  isLast,
  orderedIds,
  project,
}: {
  index: number;
  isFirst: boolean;
  isLast: boolean;
  /** IDs of the owner's projects in current display order. */
  orderedIds: string[];
  project: Project;
}) {
  const invalidateProjects = useInvalidateProjects();

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => reorderProjects(ids),
    onSuccess: () => invalidateProjects(),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProject(project.id),
    onSuccess: () => invalidateProjects(),
  });

  const thumbnail = project.images[0];

  function move(fromIndex: number, toIndex: number) {
    // Submit only the currently displayed owner's project IDs.
    const next = [...orderedIds];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved!);
    reorderMutation.mutate(next);
  }

  return (
    <li className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Thumbnail */}
        <Link
          aria-hidden={thumbnail ? undefined : true}
          className="block h-28 w-full shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 sm:h-24 sm:w-32"
          tabIndex={-1}
          to={`/professional/projects/${project.id}`}
        >
          {thumbnail ? (
            <img
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              src={thumbnail}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-zinc-400">
              <Images aria-hidden="true" className="size-6" strokeWidth={1.5} />
            </span>
          )}
        </Link>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ProjectStatusBadge status={project.status} />
            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
              Order {project.displayOrder}
            </span>
            {project.projectType ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                {project.projectType}
              </span>
            ) : null}
            {project.publishedAt ? (
              <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                <CalendarDays aria-hidden="true" className="size-3.5" />
                Published {formatDate(project.publishedAt)}
              </span>
            ) : null}
          </div>

          <h2 className="mt-2 font-semibold text-zinc-950">
            <Link
              className="hover:text-emerald-800 hover:underline"
              to={`/professional/projects/${project.id}`}
            >
              {project.title}
            </Link>
          </h2>

          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
            {project.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin aria-hidden="true" className="size-3.5" />
                {project.location}
              </span>
            ) : null}
            {project.budget ? (
              <span>Budget {formatBudget(project.budget)}</span>
            ) : null}
            {project.startDate || project.endDate ? (
              <span className="inline-flex items-center gap-1">
                <CalendarDays aria-hidden="true" className="size-3.5" />
                {[project.startDate, project.endDate]
                  .filter(Boolean)
                  .map((d) => formatDate(d!))
                  .join(" → ")}
              </span>
            ) : null}
            {project.images.length > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Images aria-hidden="true" className="size-3.5" />
                {project.images.length}{" "}
                {project.images.length === 1 ? "image" : "images"}
              </span>
            ) : null}
          </div>

          {project.description ? (
            <p className="mt-1 line-clamp-2 text-sm text-zinc-500">
              {project.description}
            </p>
          ) : null}

          {/* Status lifecycle actions */}
          <div className="mt-3">
            <ProjectStatusActions
              onChanged={() => invalidateProjects()}
              project={project}
            />
          </div>

          {(reorderMutation.isError || deleteMutation.isError) ? (
            <p className="mt-2 text-xs text-red-700" role="alert">
              {getApiErrorMessage(
                reorderMutation.isError
                  ? reorderMutation.error
                  : deleteMutation.error,
                "The last action could not be completed.",
              )}
            </p>
          ) : null}
        </div>

        {/* Actions rail */}
        <div className="flex shrink-0 flex-row items-center gap-2 border-t border-zinc-100 pt-3 sm:flex-col sm:items-stretch sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
          <ReorderButton
            disabled={isFirst || reorderMutation.isPending}
            direction="up"
            label={`Move ${project.title} earlier`}
            onMove={() => move(index, index - 1)}
          />
          <ReorderButton
            disabled={isLast || reorderMutation.isPending}
            direction="down"
            label={`Move ${project.title} later`}
            onMove={() => move(index, index + 1)}
          />
          <Link
            aria-label={`Edit ${project.title}`}
            className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-zinc-300 bg-white p-2 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
            title="Edit project"
            to={`/professional/projects/${project.id}`}
          >
            <Pencil aria-hidden="true" className="size-4" />
          </Link>
          <button
            aria-label={`Delete ${project.title}`}
            className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-zinc-300 bg-white p-2 text-zinc-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (
                window.confirm(
                  `Delete "${project.title}"? This cannot be undone.`,
                )
              ) {
                deleteMutation.mutate();
              }
            }}
            title="Delete project"
            type="button"
          >
            {deleteMutation.isPending ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Trash2 aria-hidden="true" className="size-4" />
            )}
          </button>
        </div>
      </div>
    </li>
  );
}

// ── Reorder button ────────────────────────────────────────────────────────────

function ReorderButton({
  direction,
  disabled,
  label,
  onMove,
}: {
  direction: "up" | "down";
  disabled: boolean;
  label: string;
  onMove: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm font-bold text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950 disabled:opacity-40"
      disabled={disabled}
      onClick={onMove}
      title={label}
      type="button"
    >
      {direction === "up" ? "↑" : "↓"}
    </button>
  );
}
