import type { ReactNode } from "react";

export interface SectionCardProps {
  title: string;
  description?: string;
  /** Optional element rendered in the card header alongside the title */
  action?: ReactNode;
  children: ReactNode;
  /** Additional Tailwind classes for the outer container */
  className?: string;
}

export function SectionCard({
  action,
  children,
  className = "",
  description,
  title,
}: SectionCardProps) {
  return (
    <section
      aria-labelledby={`section-${title.replace(/\s+/g, "-").toLowerCase()}`}
      className={`rounded-xl border border-zinc-200 bg-white shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4">
        <div className="min-w-0">
          <h2
            className="text-sm font-semibold text-zinc-950"
            id={`section-${title.replace(/\s+/g, "-").toLowerCase()}`}
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
          ) : null}
        </div>
        {action ? (
          <div className="shrink-0">{action}</div>
        ) : null}
      </div>

      {/* Body */}
      <div className="p-5">{children}</div>
    </section>
  );
}
