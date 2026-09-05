import type { LucideIcon } from "lucide-react";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export function EmptyState({
  action,
  description,
  icon: Icon,
  title,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-400">
        <Icon aria-hidden="true" className="size-5" strokeWidth={1.6} />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-zinc-950">{title}</h3>
      <p className="mt-1 max-w-xs text-xs leading-5 text-zinc-500">
        {description}
      </p>
      {action ? (
        action.href ? (
          <a
            className="mt-5 inline-flex min-h-9 items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-semibold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring"
            href={action.href}
          >
            {action.label}
          </a>
        ) : (
          <button
            className="mt-5 inline-flex min-h-9 items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-semibold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring"
            onClick={action.onClick}
            type="button"
          >
            {action.label}
          </button>
        )
      ) : null}
    </div>
  );
}
