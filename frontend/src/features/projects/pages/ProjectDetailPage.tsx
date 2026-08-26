import {
  AlertTriangle,
  CalendarDays,
  Eye,
  ImageOff,
  LoaderCircle,
  Lock,
  MapPin,
  Pencil,
  Trash2,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  deleteProject,
  getMyProjectById,
  updateProject,
  type Project,
  type UpdateProjectInput,
} from "@/features/projects/api/projects.api";
import { ProjectForm } from "@/features/projects/components/ProjectForm";
import { ProjectStatusActions, ProjectStatusBadge } from "@/features/projects/components/ProjectStatusControls";
import { ownerProjectKey } from "@/features/projects/lib/project-queries";
import {
  formatBudget,
  formatDate,
} from "@/features/projects/lib/project-status";
import { getApiErrorMessage, getHttpStatus } from "@/shared/api/http-error";
import { FullPageStatus } from "@/shared/ui/FullPageStatus";

// ── Page ──────────────────────────────────────────────────────────────────────

export function ProjectDetailPage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const projectQuery = useQuery({
    enabled: projectId !== "",
    queryKey: ownerProjectKey(projectId),
    queryFn: ({ signal }) => getMyProjectById(projectId, signal),
    retry: false,
    staleTime: 30_000,
  });

  function handleDeleted() {
    void navigate("/professional/projects");
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
    // Foreign and non-existent projects both return 404 — present a neutral
    // not-found state either way so nothing about ownership leaks.
    if (getHttpStatus(projectQuery.error) === 404) {
      return (
        <FullPageStatus
          action={{
            label: "Back to my projects",
            onClick: () => void navigate("/professional/projects"),
          }}
          description="This project does not exist or you do not have access to it."
          icon={AlertTriangle}
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
          "The project could not be loaded.",
        )}
        icon={AlertTriangle}
        title="Project unavailable"
      />
    );
  }

  const project = projectQuery.data;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      {/* Header */}
      <div className="border-b border-zinc-200 pb-6">
        <Link
          className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
          to="/professional/projects"
        >
          ← My Projects
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-zinc-950 sm:text-3xl">
            {project.title}
          </h1>
          <ProjectStatusBadge status={project.status} />
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {/* Lifecycle */}
        <section aria-labelledby="status-heading" className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-zinc-950" id="status-heading">
            Status
          </h2>
          <dl className="mt-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex gap-2 py-1">
              <dt className="w-32 shrink-0 font-medium text-zinc-500">Current status</dt>
              <dd><ProjectStatusBadge status={project.status} /></dd>
            </div>
            <div className="flex gap-2 py-1">
              <dt className="w-32 shrink-0 font-medium text-zinc-500">Published</dt>
              <dd className="text-zinc-800">
                {project.publishedAt ? formatDate(project.publishedAt) : "Not published"}
              </dd>
            </div>
          </dl>
          <div className="mt-4 border-t border-zinc-100 pt-4">
            <p className="mb-2 text-xs font-medium uppercase text-zinc-400">
              Available actions
            </p>
            <ProjectStatusActions
              onChanged={() => void projectQuery.refetch()}
              project={project}
            />
          </div>
        </section>

        {/* Overview */}
        <ProjectOverviewSection project={project} />

        {/* Edit details */}
        <EditSection key={project.updatedAt} project={project} />

        {/* Danger zone */}
        <DangerZone onDeleted={handleDeleted} project={project} />
      </div>
    </main>
  );
}

// ── Read-only overview ────────────────────────────────────────────────────────

function ProjectOverviewSection({ project }: { project: Project }) {
  return (
    <section aria-labelledby="overview-heading" className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-950" id="overview-heading">
          Details
        </h2>
        <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
          Order {project.displayOrder}
        </span>
      </div>

      <dl className="mt-3 grid gap-x-8 text-sm sm:grid-cols-2">
        <InfoRow icon={Eye} label="Visibility">
          {project.status === "PUBLISHED"
            ? "Visible to everyone"
            : "Only visible to you"}
        </InfoRow>
        {project.projectType ? (
          <InfoRow icon={Pencil} label="Type">{project.projectType}</InfoRow>
        ) : null}
        {project.location ? (
          <InfoRow icon={MapPin} label="Location">{project.location}</InfoRow>
        ) : null}
        {project.budget ? (
          <InfoRow icon={Wallet} label="Budget">
            {formatBudget(project.budget)}
          </InfoRow>
        ) : null}
        {project.startDate || project.endDate ? (
          <InfoRow icon={CalendarDays} label="Timeline">
            {[project.startDate, project.endDate]
              .filter(Boolean)
              .map((d) => formatDate(d!))
              .join(" → ") || "—"}
          </InfoRow>
        ) : null}
      </dl>

      {project.description ? (
        <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs font-medium uppercase text-zinc-400">Description</p>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-zinc-700">
            {project.description}
          </p>
        </div>
      ) : null}

      {/* Images */}
      <div className="mt-4">
        <p className="text-xs font-medium uppercase text-zinc-400">Images</p>
        {project.images.length > 0 ? (
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {project.images.map((url) => (
              <ProjectImageTile key={url} url={url} />
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
            <ImageOff aria-hidden="true" className="size-3.5" />
            No images added yet.
          </p>
        )}
      </div>
    </section>
  );
}

function InfoRow({
  children,
  icon: Icon,
  label,
}: {
  children: React.ReactNode;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div className="flex gap-2 py-1.5">
      <dt className="flex w-32 shrink-0 items-center gap-1.5 font-medium text-zinc-500">
        <Icon aria-hidden="true" className="size-3.5" />
        {label}
      </dt>
      <dd className="min-w-0 break-words text-zinc-800">{children}</dd>
    </div>
  );
}

function ProjectImageTile({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <li className="aspect-video overflow-hidden rounded-md border border-zinc-200 bg-zinc-100">
      {failed ? (
        <span className="flex size-full items-center justify-center text-zinc-400">
          <ImageOff aria-hidden="true" className="size-5" />
        </span>
      ) : (
        <img
          alt="Project image"
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
          src={url}
        />
      )}
    </li>
  );
}

// ── Edit section ──────────────────────────────────────────────────────────────

/**
 * Terminal-status projects (COMPLETED, CANCELLED) are read-only.
 * The edit form is hidden and replaced by a clear read-only notice.
 * DRAFT, PUBLISHED, and IN_PROGRESS projects show the normal edit toggle.
 */
function EditSection({ project }: { project: Project }) {
  const [editing, setEditing] = useState(false);

  // Terminal statuses — no edits allowed.
  if (project.status === "COMPLETED" || project.status === "CANCELLED") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
        <Lock aria-hidden="true" className="size-4 shrink-0 text-zinc-400" />
        This project is{" "}
        <span className="font-semibold text-zinc-800">
          {project.status.toLowerCase()}
        </span>{" "}
        and cannot be edited.
      </div>
    );
  }

  async function submit(input: UpdateProjectInput): Promise<Project> {
    return updateProject(project.id, input);
  }

  if (editing) {
    return (
      <section aria-labelledby="edit-heading" className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="mb-4 text-base font-semibold text-zinc-950" id="edit-heading">
          Edit project
        </h2>
        <ProjectForm
          onCancel={() => setEditing(false)}
          onSaved={() => setEditing(false)}
          onSubmitInput={submit}
          project={project}
          submitLabel="Save changes"
        />
      </section>
    );
  }

  return (
    <button
      className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:w-auto"
      onClick={() => setEditing(true)}
      type="button"
    >
      <Pencil aria-hidden="true" className="size-4" />
      Edit details
    </button>
  );
}

// ── Danger zone ───────────────────────────────────────────────────────────────

function DangerZone({
  onDeleted,
  project,
}: {
  onDeleted: () => void;
  project: Project;
}) {
  const deleteMutation = useMutation({
    mutationFn: () => deleteProject(project.id),
    onSuccess: onDeleted,
  });

  return (
    <section aria-labelledby="danger-heading" className="rounded-md border border-red-200 bg-red-50/40 p-4 sm:p-5">
      <h2 className="text-base font-semibold text-red-900" id="danger-heading">
        Danger zone
      </h2>
      <p className="mt-1 text-sm text-red-700">
        Deleting a project permanently removes it. This cannot be undone.
      </p>
      <button
        className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
        disabled={deleteMutation.isPending}
        onClick={() => {
          if (window.confirm(`Delete "${project.title}"? This cannot be undone.`)) {
            deleteMutation.mutate();
          }
        }}
        type="button"
      >
        {deleteMutation.isPending ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <Trash2 aria-hidden="true" className="size-4" />
        )}
        Delete project
      </button>
      {deleteMutation.isError ? (
        <p className="mt-2 text-xs font-medium text-red-700" role="alert">
          {getApiErrorMessage(deleteMutation.error, "Could not delete the project.")}
        </p>
      ) : null}
    </section>
  );
}
