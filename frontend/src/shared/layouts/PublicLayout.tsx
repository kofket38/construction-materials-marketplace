import { Building2 } from "lucide-react";
import { Link, Outlet } from "react-router-dom";

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-stone-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Link
            aria-label="Construction Materials Marketplace home"
            className="inline-flex items-center gap-3 font-semibold text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700"
            to="/"
          >
            <span className="flex size-9 items-center justify-center rounded-md bg-emerald-700 text-white">
              <Building2 aria-hidden="true" className="size-5" />
            </span>
            <span className="hidden sm:inline">
              Construction Materials Marketplace
            </span>
            <span className="sm:hidden">CMM</span>
          </Link>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
