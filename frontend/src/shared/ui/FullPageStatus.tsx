import type { LucideIcon } from "lucide-react";

interface FullPageStatusProps {
  action?: {
    label: string;
    onClick: () => void;
  };
  description: string;
  icon: LucideIcon;
  title: string;
}

export function FullPageStatus({
  action,
  description,
  icon: Icon,
  title,
}: FullPageStatusProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-5 py-12 text-zinc-950">
      <section className="w-full max-w-md text-center" aria-live="polite">
        <span className="mx-auto flex size-12 items-center justify-center rounded-lg border border-zinc-200 bg-white text-brand-ink shadow-sm">
          <Icon aria-hidden="true" className="size-6" strokeWidth={1.8} />
        </span>
        <h1 className="mt-5 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
        {action ? (
          <button
            className="mt-6 inline-flex min-h-10 items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring"
            onClick={action.onClick}
            type="button"
          >
            {action.label}
          </button>
        ) : null}
      </section>
    </main>
  );
}
