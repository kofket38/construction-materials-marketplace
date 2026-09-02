import { AlertTriangle, FolderPlus, LoaderCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import {
  getMyProjects,
  type Project,
} from "@/features/projects/api/projects.api";
import { useCanAttachProcurement } from "@/features/projects/lib/procurement-attachment";
import { MY_PROJECTS_KEY } from "@/features/projects/lib/project-queries";
import { PROJECT_STATUS_BADGES } from "@/features/projects/lib/project-status";
import { getApiErrorMessage } from "@/shared/api/http-error";

/** Sentinel for "leave this procurement standalone". */
export const NO_PROJECT_VALUE = "";

interface ProjectProcurementSelectProps {
  /** Guidance rendered under the control. */
  description?: string;
  disabled?: boolean;
  id?: string;
  label?: string;
  onChange: (projectId: string) => void;
  /** Selected project ID, or NO_PROJECT_VALUE when nothing is attached. */
  value: string;
}

/**
 * Optional project attachment for a buyer's RFQ or order.
 *
 * Renders nothing for accounts that are not PROFESSIONAL: only professionals
 * own projects, so a CUSTOMER never sees this field and never sends a
 * projectId — their flow is byte-for-byte unchanged. Professional accounts are
 * registration-only, so there is deliberately no upgrade prompt here.
 *
 * Terminal projects are left out of the options because the backend rejects
 * them with a 409; the backend stays the authority on what may be attached,
 * and any error it returns is surfaced by the submitting form.
 */
export function ProjectProcurementSelect({
  description,
  disabled = false,
  id = "procurement-project",
  label = "Attach to project",
  onChange,
  value,
}: ProjectProcurementSelectProps) {
  const isProfessional = useCanAttachProcurement();

  const projectsQuery = useQuery({
    enabled: isProfessional,
    queryKey: MY_PROJECTS_KEY,
    queryFn: ({ signal }) => getMyProjects(signal),
    retry: false,
    staleTime: 60_000,
  });

  if (!isProfessional) {
    return null;
  }

  return (
    <div>
      <label
        className="block text-sm font-medium text-zinc-800"
        htmlFor={id}
      >
        {label}{" "}
        <span className="font-normal text-zinc-500">(optional)</span>
      </label>

      <div className="mt-1.5">
        {projectsQuery.isPending ? (
          <p
            aria-live="polite"
            className="flex min-h-11 items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-600"
          >
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin text-emerald-700"
            />
            Loading your projects...
          </p>
        ) : projectsQuery.isError ? (
          <div
            className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900"
            role="alert"
          >
            <p className="flex items-start gap-2">
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <span>
                {getApiErrorMessage(
                  projectsQuery.error,
                  "Your projects could not be loaded.",
                )}{" "}
                You can still continue without attaching a project.
              </span>
            </p>
            <button
              className="mt-2 inline-flex min-h-9 items-center rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              onClick={() => void projectsQuery.refetch()}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : (
          <AttachableProjectSelect
            disabled={disabled}
            id={id}
            onChange={onChange}
            projects={projectsQuery.data}
            value={value}
          />
        )}
      </div>

      {description ? (
        <p className="mt-1.5 text-xs leading-5 text-zinc-500">{description}</p>
      ) : null}
    </div>
  );
}

/** Statuses that can still take on new procurement. */
function canAcceptProcurement(project: Project): boolean {
  return project.status !== "COMPLETED" && project.status !== "CANCELLED";
}

function AttachableProjectSelect({
  disabled,
  id,
  onChange,
  projects,
  value,
}: {
  disabled: boolean;
  id: string;
  onChange: (projectId: string) => void;
  projects: Project[];
  value: string;
}) {
  const attachable = projects.filter(canAcceptProcurement);

  if (attachable.length === 0) {
    return (
      <p className="flex flex-wrap items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
        <FolderPlus aria-hidden="true" className="size-4 shrink-0 text-zinc-400" />
        No open project to attach this to.
        <Link
          className="font-semibold text-emerald-700 underline hover:text-emerald-800"
          to="/professional/projects/new"
        >
          Create a project
        </Link>
      </p>
    );
  }

  return (
    <select
      className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 disabled:opacity-60"
      disabled={disabled}
      id={id}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      <option value={NO_PROJECT_VALUE}>
        — Not linked to a project —
      </option>
      {attachable.map((project) => (
        <option key={project.id} value={project.id}>
          {project.title} ({PROJECT_STATUS_BADGES[project.status].label})
        </option>
      ))}
    </select>
  );
}
