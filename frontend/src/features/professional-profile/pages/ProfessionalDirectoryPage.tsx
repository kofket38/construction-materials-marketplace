import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  LogIn,
  Plus,
  Search,
  Users,
  UserPlus,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { getOwnProfessionalProfile, listProfessionalProfiles } from "@/features/professional-profile/api/professional-profile.api";
import type {
  ProfessionalDirectorySortBy,
  ProfessionalDirectorySortOrder,
} from "@/features/professional-profile/api/professional-profile.api";
import { useAuthStore } from "@/features/auth/model/auth.store";
import { ProfessionalCard } from "@/features/professional-profile/components/ProfessionalCard";
import { getApiErrorMessage } from "@/shared/api/http-error";

const PAGE_SIZE = 12;

const sortOptions = [
  {
    label: "Newest",
    sortBy: "newest",
    sortOrder: "desc",
    value: "newest-desc",
  },
  {
    label: "Oldest",
    sortBy: "oldest",
    sortOrder: "asc",
    value: "oldest-asc",
  },
  {
    label: "Most experience",
    sortBy: "experience",
    sortOrder: "desc",
    value: "experience-desc",
  },
  {
    label: "Name A–Z",
    sortBy: "name",
    sortOrder: "asc",
    value: "name-asc",
  },
  {
    label: "Name Z–A",
    sortBy: "name",
    sortOrder: "desc",
    value: "name-desc",
  },
] as const satisfies ReadonlyArray<{
  label: string;
  sortBy: ProfessionalDirectorySortBy;
  sortOrder: ProfessionalDirectorySortOrder;
  value: string;
}>;

type SortValue = (typeof sortOptions)[number]["value"];

export function ProfessionalDirectoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search")?.trim() ?? "";
  const profession = searchParams.get("profession")?.trim() ?? "";
  const specialty = searchParams.get("specialty")?.trim() ?? "";
  const city = searchParams.get("city")?.trim() ?? "";
  const page = parsePage(searchParams.get("page"));
  const selectedSort =
    sortOptions.find((option) => option.value === parseSortValue(searchParams.get("sort"))) ??
    sortOptions[0];

  const directoryQuery = useQuery({
    queryKey: [
      "professional-profiles",
      "directory",
      {
        page,
        search,
        profession,
        specialty,
        city,
        sort: selectedSort.value,
      },
    ],
    queryFn: ({ signal }) =>
      listProfessionalProfiles(
        {
          city: city || undefined,
          limit: PAGE_SIZE,
          page,
          profession: profession || undefined,
          search: search || undefined,
          sortBy: selectedSort.sortBy,
          sortOrder: selectedSort.sortOrder,
          specialty: specialty || undefined,
        },
        signal,
      ),
    placeholderData: keepPreviousData,
  });

  function updateSearchParams(
    updates: Record<string, string | undefined>,
  ): void {
    const nextParams = new URLSearchParams(searchParams);

    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        nextParams.set(key, value);
      } else {
        nextParams.delete(key);
      }
    }

    setSearchParams(nextParams);
  }

  function handleSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    updateSearchParams({
      city: formData.get("city")?.toString().trim() || undefined,
      page: undefined,
      profession: formData.get("profession")?.toString().trim() || undefined,
      search: formData.get("search")?.toString().trim() || undefined,
      specialty: formData.get("specialty")?.toString().trim() || undefined,
    });
  }

  function clearFilters(): void {
    setSearchParams({});
  }

  const hasActiveFilters =
    Boolean(search) ||
    Boolean(profession) ||
    Boolean(specialty) ||
    Boolean(city) ||
    selectedSort.value !== "newest-desc";

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-700">
            Professional marketplace
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">
            Professionals
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            Discover experienced construction professionals and explore their
            public profiles.
          </p>
        </div>
        {directoryQuery.data ? (
          <p aria-live="polite" className="text-sm font-medium text-zinc-600">
            {directoryQuery.data.totalItems.toLocaleString()}{" "}
            {directoryQuery.data.totalItems === 1
              ? "professional"
              : "professionals"}
          </p>
        ) : null}
      </div>

      <form
        className="mt-8 grid gap-3 border-y border-zinc-200 py-4 md:grid-cols-[minmax(14rem,1fr)_minmax(9rem,1fr)_minmax(9rem,1fr)_minmax(9rem,1fr)_11rem_auto]"
        onSubmit={handleSearch}
        role="search"
      >
        <label className="relative block">
          <span className="sr-only">Search professionals</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
          />
          <input
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white py-2 pl-10 pr-3 text-sm text-zinc-950 outline-none transition-colors placeholder:text-zinc-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
            defaultValue={search}
            key={search}
            name="search"
            placeholder="Name, headline, or specialty"
            type="search"
          />
        </label>

        <label>
          <span className="sr-only">Profession</span>
          <input
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition-colors placeholder:text-zinc-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
            defaultValue={profession}
            key={profession}
            name="profession"
            placeholder="Profession"
            type="text"
          />
        </label>

        <label>
          <span className="sr-only">Specialty</span>
          <input
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition-colors placeholder:text-zinc-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
            defaultValue={specialty}
            key={specialty}
            name="specialty"
            placeholder="Specialty"
            type="text"
          />
        </label>

        <label>
          <span className="sr-only">City</span>
          <input
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition-colors placeholder:text-zinc-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
            defaultValue={city}
            key={city}
            name="city"
            placeholder="City"
            type="text"
          />
        </label>

        <label>
          <span className="sr-only">Sort professionals</span>
          <select
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
            onChange={(event) => {
              const value = event.target.value as SortValue;
              updateSearchParams({
                page: undefined,
                sort:
                  value === "newest-desc" ? undefined : value,
              });
            }}
            value={selectedSort.value}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-2">
          <button
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 md:flex-none"
            type="submit"
          >
            <Search aria-hidden="true" className="size-4" />
            Search
          </button>
          {hasActiveFilters ? (
            <button
              aria-label="Clear directory filters"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
              onClick={clearFilters}
              title="Clear filters"
              type="button"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          ) : null}
        </div>
      </form>

      {directoryQuery.isPending ? (
        <DirectoryStatus>
          <LoaderCircle
            aria-hidden="true"
            className="size-6 animate-spin text-emerald-700"
          />
          <p>Loading professionals...</p>
        </DirectoryStatus>
      ) : directoryQuery.isError ? (
        <DirectoryStatus>
          <Users aria-hidden="true" className="size-9 text-red-700" strokeWidth={1.6} />
          <div className="text-center">
            <h2 className="font-semibold text-zinc-950">
              Unable to load professionals
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-zinc-600">
              {getApiErrorMessage(
                directoryQuery.error,
                "The professional directory could not be loaded. Please try again.",
              )}
            </p>
          </div>
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
            onClick={() => void directoryQuery.refetch()}
            type="button"
          >
            Try again
          </button>
        </DirectoryStatus>
        ) : directoryQuery.data.totalPages > 0 &&
          directoryQuery.data.currentPage > directoryQuery.data.totalPages ? (
          <DirectoryStatus>
            <Users aria-hidden="true" className="size-9 text-emerald-700" strokeWidth={1.6} />
            <div className="text-center">
              <h2 className="font-semibold text-zinc-950">
                This page is out of range
              </h2>
              <p className="mt-2 text-sm text-zinc-600">
                Page {directoryQuery.data.currentPage} does not exist. The
                directory has {directoryQuery.data.totalPages}{" "}
                {directoryQuery.data.totalPages === 1 ? "page" : "pages"}.
              </p>
            </div>
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              onClick={() => updateSearchParams({ page: undefined })}
              type="button"
            >
              Return to page 1
            </button>
          </DirectoryStatus>
        ) : directoryQuery.data.professionals.length === 0 ? (
        hasActiveFilters ? (
          <DirectoryStatus>
            <Users aria-hidden="true" className="size-9 text-emerald-700" strokeWidth={1.6} />
            <div className="text-center">
              <h2 className="font-semibold text-zinc-950">
                No professionals match your search
              </h2>
              <p className="mt-2 text-sm text-zinc-600">
                Try a different name, profession, specialty, or city.
              </p>
            </div>
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              onClick={clearFilters}
              type="button"
            >
              Clear filters
            </button>
            <DirectoryJoinCta />
          </DirectoryStatus>
        ) : (
          <DirectoryStatus>
            <Users aria-hidden="true" className="size-9 text-emerald-700" strokeWidth={1.6} />
            <div className="text-center">
              <h2 className="font-semibold text-zinc-950">
                No professionals are available yet
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-zinc-600">
                Published professional profiles will appear here once
                professionals complete their profiles.
              </p>
            </div>
            <DirectoryJoinCta />
          </DirectoryStatus>
        )
      ) : (
        <>
          <div
            aria-busy={directoryQuery.isFetching}
            className={`mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 ${
              directoryQuery.isFetching ? "opacity-60" : ""
            }`}
          >
            {directoryQuery.data.professionals.map((professional) => (
              <ProfessionalCard key={professional.id} professional={professional} />
            ))}
          </div>

          {directoryQuery.data.totalPages > 1 ? (
            <nav
              aria-label="Professional directory pagination"
              className="mt-8 flex items-center justify-between border-t border-zinc-200 pt-5"
            >
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!directoryQuery.data.hasPreviousPage}
                onClick={() =>
                  updateSearchParams({
                    page: page > 2 ? String(page - 1) : undefined,
                  })
                }
                type="button"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                Previous
              </button>
              <p className="text-sm text-zinc-600">
                Page{" "}
                <span className="font-semibold text-zinc-950">
                  {directoryQuery.data.currentPage}
                </span>{" "}
                of {directoryQuery.data.totalPages}
              </p>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!directoryQuery.data.hasNextPage}
                onClick={() => updateSearchParams({ page: String(page + 1) })}
                type="button"
              >
                Next
                <ArrowRight aria-hidden="true" className="size-4" />
              </button>
            </nav>
          ) : null}
        </>
      )}
    </main>
  );
}

function DirectoryStatus({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-live="polite"
      className="flex min-h-80 flex-col items-center justify-center gap-4 py-12 text-sm font-medium text-zinc-600"
    >
      {children}
    </section>
  );
}

const ctaPrimaryClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950";

const ctaSecondaryClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950";

function DirectoryJoinCta() {
  const isAuthenticated = useAuthStore(
    (state) => state.status === "authenticated",
  );
  // Professional accounts are registration-only — a CUSTOMER, SELLER, or ADMIN
  // cannot create a professional profile, so only PROFESSIONAL accounts are
  // offered the CTA (and only they need the own-profile lookup).
  const role = useAuthStore((state) => state.user?.role);
  const isProfessional = isAuthenticated && role === "PROFESSIONAL";

  const meQuery = useQuery({
    queryKey: ["professional-profile", "me"] as const,
    queryFn: ({ signal }) => getOwnProfessionalProfile(signal),
    enabled: isProfessional,
    staleTime: 30_000,
    retry: false,
  });

  if (!isAuthenticated) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link className={ctaPrimaryClassName} to="/register">
          <UserPlus aria-hidden="true" className="size-4" />
          Register to create your profile
        </Link>
        <Link className={ctaSecondaryClassName} to="/login">
          <LogIn aria-hidden="true" className="size-4" />
          Sign in
        </Link>
      </div>
    );
  }

  if (!isProfessional || !meQuery.isSuccess || meQuery.data !== null) {
    return null;
  }

  return (
    <Link className={ctaPrimaryClassName} to="/profile/professional">
      <Plus aria-hidden="true" className="size-4" />
      Create your professional profile
    </Link>
  );
}

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function parseSortValue(value: string | null): SortValue {
  return sortOptions.some((option) => option.value === value)
    ? (value as SortValue)
    : "newest-desc";
}
