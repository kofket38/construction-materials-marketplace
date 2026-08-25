import type { LucideIcon } from "lucide-react";

export interface StatCardProps {
  label: string;
  value: string | number;
  /** Optional descriptive line beneath the value, e.g. "+12% this month" */
  description?: string;
  icon?: LucideIcon;
  /** Tailwind colour classes for the icon container, e.g. "bg-emerald-50 text-emerald-700" */
  iconTone?: string;
  /** Render a pulsing skeleton instead of real content */
  loading?: boolean;
}

export function StatCard({
  description,
  icon: Icon,
  iconTone = "bg-zinc-100 text-zinc-600",
  label,
  loading = false,
  value,
}: StatCardProps) {
  if (loading) {
    return (
      <div
        aria-hidden="true"
        className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-24 animate-pulse rounded bg-zinc-200" />
            <div className="h-7 w-16 animate-pulse rounded bg-zinc-200" />
          </div>
          <div className="size-9 animate-pulse rounded-lg bg-zinc-200" />
        </div>
        <div className="mt-3 h-3 w-28 animate-pulse rounded bg-zinc-100" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-semibold text-zinc-950">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
        </div>
        {Icon ? (
          <span
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconTone}`}
          >
            <Icon aria-hidden="true" className="size-4" />
          </span>
        ) : null}
      </div>
      {description ? (
        <p className="mt-2 text-xs text-zinc-500">{description}</p>
      ) : null}
    </div>
  );
}
