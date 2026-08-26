import { LoaderCircle } from "lucide-react";
import { useState } from "react";

import {
  changeProjectStatus,
  type Project,
  type ProjectStatus,
} from "@/features/projects/api/projects.api";
import {
  PROJECT_STATUS_BADGES,
  projectStatusTransitions,
} from "@/features/projects/lib/project-status";
import { getApiErrorMessage } from "@/shared/api/http-error";

// ── Status badge ──────────────────────────────────────────────────────────────

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const badge = PROJECT_STATUS_BADGES[status];
  const Icon = badge.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
    >
      <Icon aria-hidden="true" className="size-3" />
      {badge.label}
    </span>
  );
}

// ── Status action controls ────────────────────────────────────────────────────

function buttonClass(tone: "primary" | "neutral"): string {
  return [
    "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60",
    tone === "primary"
      ? "bg-emerald-700 text-white hover:bg-emerald-800"
      : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50",
  ].join(" ");
}

/**
 * Renders the valid lifecycle actions for a project's current status. Invalid
 * transitions are never rendered, so the UI can never invent a move the
 * backend would reject.
 */
export function ProjectStatusActions({
  onChanged,
  project,
}: {
  onChanged: (project: Project) => void;
  project: Pick<Project, "id" | "status">;
}) {
  const transitions = projectStatusTransitions(project.status);

  if (transitions.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        This project is{" "}
        {project.status === "COMPLETED" ? "completed" : "cancelled"} and is now
        read-only.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {transitions.map((transition) => (
        <StatusActionButton
          key={transition.to}
          onChanged={onChanged}
          projectId={project.id}
          transition={transition}
        />
      ))}
    </div>
  );
}

function StatusActionButton({
  onChanged,
  projectId,
  transition,
}: {
  onChanged: (project: Project) => void;
  projectId: string;
  transition: ReturnType<typeof projectStatusTransitions>[number];
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (transition.confirm && !window.confirm(transition.confirm)) {
      return;
    }

    setPending(true);
    setError(null);
    try {
      const updated = await changeProjectStatus(projectId, transition.to);
      onChanged(updated);
    } catch (caught) {
      setError(
        getApiErrorMessage(caught, "Could not update the project status."),
      );
      setPending(false);
    }
  }

  const Icon = pending ? LoaderCircle : transition.icon;

  return (
    <>
      <button
        className={buttonClass(transition.tone)}
        disabled={pending}
        onClick={() => void onClick()}
        type="button"
      >
        <Icon
          aria-hidden="true"
          className={`size-4 ${pending ? "animate-spin" : ""}`}
        />
        {transition.label}
      </button>
      {error ? (
        <p className="w-full text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
