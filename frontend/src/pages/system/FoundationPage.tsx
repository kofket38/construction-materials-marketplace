import { CheckCircle2 } from "lucide-react";

export function FoundationPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <section className="max-w-2xl">
        <span className="inline-flex size-11 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
          <CheckCircle2 aria-hidden="true" className="size-6" />
        </span>
        <p className="mt-6 text-sm font-semibold text-emerald-700">
          Frontend foundation
        </p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
          Construction Materials Marketplace
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600">
          The application shell is ready for the public product catalog.
        </p>
      </section>
    </main>
  );
}
