import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
      <section>
        <p className="text-sm font-semibold text-emerald-700">404</p>
        <h1 className="mt-2 text-3xl font-semibold">Page not found</h1>
        <p className="mt-3 text-base text-zinc-600">
          The requested page does not exist.
        </p>
        <Link
          className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
          to="/"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Return home
        </Link>
      </section>
    </main>
  );
}
