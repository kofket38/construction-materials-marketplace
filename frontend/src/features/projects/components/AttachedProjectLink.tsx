import { FolderKanban } from "lucide-react";
import { Link } from "react-router-dom";

import type { LinkedProjectSummary } from "@/features/projects/api/projects.api";
import { ProjectStatusBadge } from "@/features/projects/components/ProjectStatusControls";

/**
 * Names the project a request for quote or an order is attached to, and links
 * through to it.
 *
 * Rendering is caller-guarded on the summary being present, which needs no role
 * check of its own: the backend fills it in for the project owner alone, so a
 * seller quoting the request and an administrator reviewing it receive null and
 * see nothing here — the same thing a standalone purchase shows. The link
 * target is the owner-only project page, which applies its own authorization.
 */
export function AttachedProjectLink({
  project,
}: {
  project: LinkedProjectSummary;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Link
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink underline-offset-2 hover:underline"
        to={`/professional/projects/${encodeURIComponent(project.id)}`}
      >
        <FolderKanban aria-hidden="true" className="size-4 shrink-0" />
        {project.title}
      </Link>
      <ProjectStatusBadge status={project.status} />
    </span>
  );
}
