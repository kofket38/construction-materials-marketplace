import type { LucideIcon } from "lucide-react";
import {
  Ban,
  CheckCircle2,
  Eye,
  EyeOff,
  PlayCircle,
  Rocket,
  Undo2,
} from "lucide-react";

import type { ProjectStatus } from "@/features/projects/api/projects.api";

// ── Lifecycle state machine (mirrors the backend service) ─────────────────────

export interface StatusTransition {
  to: ProjectStatus;
  label: string;
  icon: LucideIcon;
  tone: "primary" | "neutral";
  /** High-impact moves require confirmation before they are sent. */
  confirm?: string;
}

const STATUS_TRANSITIONS: Record<ProjectStatus, StatusTransition[]> = {
  DRAFT: [{ to: "PUBLISHED", label: "Publish", icon: Rocket, tone: "primary" }],
  PUBLISHED: [
    {
      to: "IN_PROGRESS",
      label: "Start Project",
      icon: PlayCircle,
      tone: "primary",
    },
    { to: "DRAFT", label: "Withdraw", icon: Undo2, tone: "neutral" },
    {
      to: "CANCELLED",
      label: "Cancel",
      icon: Ban,
      tone: "neutral",
      confirm:
        "Cancel this project? Cancelled projects cannot be reopened or edited again.",
    },
  ],
  IN_PROGRESS: [
    {
      to: "COMPLETED",
      label: "Complete",
      icon: CheckCircle2,
      tone: "primary",
      confirm:
        "Mark this project as completed? Completed projects become read-only.",
    },
    {
      to: "CANCELLED",
      label: "Cancel",
      icon: Ban,
      tone: "neutral",
      confirm:
        "Cancel this project? Cancelled projects cannot be reopened or edited again.",
    },
  ],
  COMPLETED: [],
  CANCELLED: [],
};

/** The valid lifecycle moves out of a status. Invalid moves are never shown. */
export function projectStatusTransitions(
  status: ProjectStatus,
): StatusTransition[] {
  return STATUS_TRANSITIONS[status];
}

// ── Badge presentation ────────────────────────────────────────────────────────

export interface StatusBadgeConfig {
  label: string;
  className: string;
  icon: LucideIcon;
}

export const PROJECT_STATUS_BADGES: Record<ProjectStatus, StatusBadgeConfig> = {
  DRAFT: {
    className: "border-zinc-200 bg-zinc-100 text-zinc-600",
    icon: EyeOff,
    label: "Draft",
  },
  PUBLISHED: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: Eye,
    label: "Published",
  },
  IN_PROGRESS: {
    className: "border-blue-200 bg-blue-50 text-blue-700",
    icon: PlayCircle,
    label: "In progress",
  },
  COMPLETED: {
    className: "border-teal-200 bg-teal-50 text-teal-700",
    icon: CheckCircle2,
    label: "Completed",
  },
  CANCELLED: {
    className: "border-red-200 bg-red-50 text-red-700",
    icon: Ban,
    label: "Cancelled",
  },
};

// ── Display helpers ───────────────────────────────────────────────────────────

const priceFormatter = new Intl.NumberFormat("en-ET", {
  currency: "ETB",
  minimumFractionDigits: 2,
  style: "currency",
});

/** Formats a backend two-decimal budget string as ETB currency. */
export function formatBudget(budget: string): string {
  const numeric = Number(budget);
  return Number.isFinite(numeric) ? priceFormatter.format(numeric) : budget;
}

/** Formats an ISO date string in UTC so date-only values never shift days. */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
