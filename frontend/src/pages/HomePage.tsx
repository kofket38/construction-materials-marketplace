/**
 * The marketplace front door.
 *
 * `/` used to render the catalog, so the first thing a visitor met was a filter
 * bar and a grid of cards. This page is the shopfront instead: a real
 * construction-site photograph, the search a buyer starts with, the trade the
 * material sits in, and products pulled from the live catalog. `/products` keeps
 * the catalog exactly as it was, one click away.
 *
 * Every claim here maps to something the application does. There is no supplier
 * verification field in the schema, so nothing on this page says "verified";
 * there are no supplier counts, no delivery guarantees and no invented
 * statistics. The strip under the hero names real features — city and
 * availability filters, price sorting, RFQs, per-listing delivery, bank transfer
 * with uploaded proof.
 *
 * Three layout rules keep it honest at 320px. The hero photograph is an
 * absolutely-positioned `object-cover` child of a content-sized box, so it can
 * never set the page width or shift the layout as it decodes. Every grid track is
 * `minmax(0,…)`, so a long product name cannot widen a column. And the category
 * strip is the only element allowed to scroll sideways, which is why it — not the
 * page — carries `rail-scroll`.
 */
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  FileText,
  HardHat,
  LoaderCircle,
  PackageSearch,
  Search,
  SlidersHorizontal,
  Store,
  Truck,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { useAuthStore } from "@/features/auth/model/auth.store";
import { useMarketplaceLocationStore } from "@/features/marketplace/model/marketplace-location.store";
import { useMarketplaceCategories } from "@/features/marketplace/model/use-marketplace-categories";
import { getProducts } from "@/features/products/api/products.api";
import { ProductCard } from "@/features/products/components/ProductCard";
import {
  categoryImageSrc,
  categoryPlaceholderIconKey,
  placeholderIcons,
} from "@/features/products/lib/product-image";
import {
  defaultProductSortValue,
  productSortOptions,
} from "@/features/products/lib/product-sort";
import type { ProductCategory } from "@/features/products/model/product";
import { getApiErrorMessage } from "@/shared/api/http-error";

/** Eucalyptus-pole scaffolding on a live site: warm tones, works with yellow. */
const HERO_IMAGE = "/images/hero/site-c.png";
const POPULAR_LIMIT = 8;
const CONTAINER = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

/**
 * What CMM can stand behind, in the order a buyer meets it. Each line describes
 * a feature that exists today; none of them is a promise the marketplace cannot
 * keep on a buyer's behalf.
 */
const CAPABILITIES: readonly {
  description: string;
  icon: LucideIcon;
  title: string;
}[] = [
  {
    icon: Store,
    title: "Named suppliers",
    description:
      "Every listing carries the supplier's shop name and the city it is stocked in.",
  },
  {
    icon: SlidersHorizontal,
    title: "Compare before you buy",
    description:
      "Filter by city and availability, then sort by price across suppliers.",
  },
  {
    icon: FileText,
    title: "Quotes for bulk orders",
    description:
      "Send a request for quotation and collect written quotes from suppliers.",
  },
  {
    icon: Truck,
    title: "Delivery stated per listing",
    description:
      "Each listing says whether the supplier delivers or you collect on site.",
  },
  {
    icon: Wallet,
    title: "Bank transfer with proof",
    description:
      "Pay by transfer, upload your payment proof, and the supplier confirms it.",
  },
];

export function HomePage() {
  const user = useAuthStore((state) => state.user);
  const selectedCity = useMarketplaceLocationStore(
    (state) => state.selectedCity,
  );

  // A seller has no use for the buyer shopfront, and `/` has always redirected
  // them to their inventory. Preserved exactly, so the logo keeps its behaviour.
  if (user?.role === "SELLER") {
    return <Navigate replace to="/seller/inventory" />;
  }

  return (
    <main>
      <HeroSection />
      <SearchBand />
      <CapabilityStrip />
      <CategorySection />
      <PopularMaterials city={selectedCity} />
      <MoreWaysToBuy isSignedIn={Boolean(user)} />
    </main>
  );
}

/**
 * `bg-scrim` and `text-on-solid` hold the same value in both themes, so the
 * photograph keeps its dark treatment and its ink keeps its contrast whichever
 * theme is active. A hero built from `bg-zinc-950`/`text-white` would invert in
 * light mode and put white text on a pale wash.
 */
function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden bg-scrim">
      <img
        alt="Pole scaffolding rising around a concrete building under construction"
        className="absolute inset-0 -z-10 size-full object-cover"
        decoding="async"
        src={HERO_IMAGE}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-br from-scrim/95 via-scrim/80 to-scrim/55"
      />

      <div className={`${CONTAINER} py-14 sm:py-20 lg:py-28`}>
        <p className="inline-flex items-center gap-2 rounded-full border border-on-solid/20 bg-on-solid/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-on-solid">
          <HardHat aria-hidden="true" className="size-4 text-brand" />
          Construction materials marketplace
        </p>
        <h1 className="mt-5 max-w-3xl text-3xl font-bold leading-tight tracking-tight text-on-solid sm:text-4xl lg:text-5xl">
          Quality construction materials, trusted suppliers, delivered to your
          site
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-on-solid/85 sm:text-lg">
          Find the materials you need, compare suppliers and prices, and order
          for your construction project.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-brand px-6 py-3 text-sm font-bold uppercase tracking-wide text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring"
            to="/products"
          >
            Shop materials
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
          <Link
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-on-solid/30 bg-on-solid/10 px-6 py-3 text-sm font-bold uppercase tracking-wide text-on-solid transition-colors hover:bg-on-solid/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring"
            to="/stores"
          >
            <Store aria-hidden="true" className="size-4" />
            Find suppliers
          </Link>
        </div>
      </div>
    </section>
  );
}

/** The catalog's own control styling, so the two search bars look related. */
const FIELD =
  "min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand-ring/15";

/**
 * The shopfront search. It holds no filter state of its own: it builds the query
 * string `/products` already parses and navigates there, so a search started
 * here and a search typed into the catalog land in exactly the same place — and
 * the category list comes from the same cache entry the catalog filter reads.
 */
function SearchBand() {
  const navigate = useNavigate();
  const categoriesQuery = useMarketplaceCategories();
  const categories = categoriesQuery.data ?? [];

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    for (const field of ["search", "categoryId", "stock", "sort"] as const) {
      const value = form.get(field)?.toString().trim();
      // The catalog treats a missing `sort` as its default, so sending the
      // default explicitly would only make the URL longer.
      if (value && !(field === "sort" && value === defaultProductSortValue)) {
        params.set(field, value);
      }
    }

    const query = params.toString();
    navigate(query ? `/products?${query}` : "/products");
  }

  return (
    <section
      aria-label="Search construction materials"
      className={`${CONTAINER} relative z-10 -mt-8`}
    >
      <form
        className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-md sm:grid-cols-2 sm:p-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
        onSubmit={handleSubmit}
        role="search"
      >
        <label className="relative block sm:col-span-2 lg:col-span-1">
          <span className="sr-only">Search materials</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
          />
          <input
            className={`${FIELD} min-h-12 pl-10 text-base text-zinc-950 placeholder:text-zinc-400`}
            name="search"
            placeholder="Search cement, rebar, blocks, paint…"
            type="search"
          />
        </label>

        <label>
          <span className="sr-only">Category</span>
          <select className={`${FIELD} min-h-12`} name="categoryId">
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="sr-only">Availability</span>
          <select className={`${FIELD} min-h-12`} name="stock">
            <option value="">All availability</option>
            <option value="in_stock">In stock</option>
            <option value="out_of_stock">Out of stock</option>
          </select>
        </label>

        <label>
          <span className="sr-only">Sort results</span>
          <select className={`${FIELD} min-h-12`} name="sort">
            {productSortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-brand px-6 py-2 text-sm font-bold uppercase tracking-wide text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring sm:col-span-2 lg:col-span-1"
          type="submit"
        >
          <Search aria-hidden="true" className="size-4" />
          Search
        </button>
      </form>
    </section>
  );
}

function CapabilityStrip() {
  return (
    <section
      aria-label="How buying on CMM works"
      className={`${CONTAINER} pt-12 sm:pt-14`}
    >
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {CAPABILITIES.map(({ description, icon: Icon, title }) => (
          <li
            className="flex gap-3 rounded-md border border-zinc-200 bg-white p-4"
            key={title}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-brand-line bg-brand-soft text-brand-ink">
              <Icon aria-hidden="true" className="size-4" strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-950">{title}</p>
              <p className="mt-1 text-xs leading-5 text-zinc-600">
                {description}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionHeading({
  action,
  eyebrow,
  title,
}: {
  action?: { label: string; to: string };
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-ink">
          {eyebrow}
        </p>
        <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
          {title}
        </h2>
      </div>
      {action ? (
        <Link
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring"
          to={action.to}
        >
          {action.label}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </div>
  );
}

/**
 * The trade a buyer thinks in. Category art is honest in a way product art is
 * not — a photograph of blockwork genuinely does represent "Masonry" — so these
 * tiles use `categoryImageSrc`, and a category the mapping has no photograph for
 * falls back to the same trade icon the product placeholder uses rather than to a
 * stand-in picture.
 *
 * On phones the strip scrolls sideways on purpose; from `sm` up the same list
 * becomes a grid. One DOM tree, so there is no second markup path to keep in
 * step, and `rail-scroll` sits on the list rather than on the page.
 */
function CategorySection() {
  const categoriesQuery = useMarketplaceCategories();

  return (
    <section className={`${CONTAINER} pt-12 sm:pt-16`}>
      <SectionHeading
        action={{ label: "All materials", to: "/products" }}
        eyebrow="Trades"
        title="Shop by category"
      />

      {categoriesQuery.isPending ? (
        <ul className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <li
              aria-hidden="true"
              className="animate-pulse overflow-hidden rounded-md border border-zinc-200 bg-white"
              key={index}
            >
              <span className="block aspect-[4/3] bg-raised" />
              <span className="m-3 block h-4 rounded bg-raised" />
            </li>
          ))}
        </ul>
      ) : categoriesQuery.isError || categoriesQuery.data.length === 0 ? (
        <SectionStatus>
          {categoriesQuery.isError
            ? getApiErrorMessage(
                categoriesQuery.error,
                "Categories could not be loaded.",
              )
            : "No categories have been published yet."}
        </SectionStatus>
      ) : (
        <ul className="rail-scroll mt-7 flex snap-x gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 lg:grid-cols-4 xl:grid-cols-6">
          {categoriesQuery.data.map((category) => (
            <CategoryTile category={category} key={category.id} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CategoryTile({ category }: { category: ProductCategory }) {
  const src = categoryImageSrc(category.name);
  const Icon = placeholderIcons[categoryPlaceholderIconKey(category.name)];

  return (
    <li className="w-40 shrink-0 snap-start sm:w-auto">
      <Link
        className="group flex h-full flex-col overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring"
        to={`/products?categoryId=${encodeURIComponent(category.id)}`}
      >
        {/* Fixed aspect ratio on the frame, `object-cover` on the photograph:
            the tile occupies its final height before the image decodes. */}
        <span className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-sunken text-ink-faint">
          {src ? (
            <img
              alt=""
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
              loading="lazy"
              src={src}
            />
          ) : (
            <Icon aria-hidden="true" className="size-8" strokeWidth={1.35} />
          )}
        </span>
        <span className="break-anywhere flex min-h-11 flex-1 items-center px-3 py-2.5 text-sm font-semibold leading-5 text-zinc-950 transition-colors group-hover:text-brand-ink">
          {category.name}
        </span>
      </Link>
    </li>
  );
}

function SectionStatus({ children }: { children: ReactNode }) {
  return (
    <div
      aria-live="polite"
      className="mt-7 flex flex-col items-center gap-3 rounded-md border border-dashed border-zinc-300 bg-white px-5 py-10 text-center text-sm leading-6 text-zinc-600"
    >
      {children}
    </div>
  );
}

/**
 * Real catalog rows, ranked by the same `popularity` sort the catalog offers and
 * scoped to the selected city when the visitor has chosen one. Nothing here is
 * hand-curated and no rating, review or stock figure is invented — if the
 * marketplace has no listings to show, the section says exactly that.
 */
function PopularMaterials({ city }: { city: string | null }) {
  const popularQuery = useQuery({
    queryKey: ["products", "popular", { city, limit: POPULAR_LIMIT }],
    queryFn: ({ signal }) =>
      getProducts(
        {
          city: city ?? undefined,
          limit: POPULAR_LIMIT,
          sortBy: "popularity",
          sortOrder: "desc",
        },
        signal,
      ),
  });

  return (
    <section className={`${CONTAINER} pt-12 sm:pt-16`}>
      <SectionHeading
        action={{
          label: "View all materials",
          to: "/products?sort=popularity-desc",
        }}
        eyebrow={city ? `${city} marketplace` : "From the catalog"}
        title="Popular materials"
      />

      {popularQuery.isPending ? (
        <SectionStatus>
          <LoaderCircle
            aria-hidden="true"
            className="size-6 animate-spin text-brand-ink"
          />
          Loading materials from the catalog…
        </SectionStatus>
      ) : popularQuery.isError ? (
        <SectionStatus>
          <PackageSearch
            aria-hidden="true"
            className="size-8 text-ink-faint"
            strokeWidth={1.5}
          />
          {getApiErrorMessage(
            popularQuery.error,
            "Materials could not be loaded.",
          )}
          <button
            className="inline-flex min-h-10 items-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring"
            onClick={() => void popularQuery.refetch()}
            type="button"
          >
            Try again
          </button>
        </SectionStatus>
      ) : popularQuery.data.products.length === 0 ? (
        <SectionStatus>
          <PackageSearch
            aria-hidden="true"
            className="size-8 text-ink-faint"
            strokeWidth={1.5}
          />
          {city
            ? `No suppliers stock materials in ${city} yet. Change the city or browse every listing.`
            : "No listings have been published yet."}
          <Link
            className="inline-flex min-h-10 items-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring"
            to="/products"
          >
            Browse the catalog
          </Link>
        </SectionStatus>
      ) : (
        // The same track definition the catalog grid uses, so a card is the same
        // width on both pages: one per row on a phone, never four on mobile.
        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {popularQuery.data.products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * The closing band. Every tile is a route that exists in `app-router.tsx`, and
 * the quotation tile points at registration for a visitor who is not signed in,
 * because `/rfqs/new` sits behind the buyer role guard — sending a guest there
 * would bounce them to the login screen with no explanation.
 */
function MoreWaysToBuy({ isSignedIn }: { isSignedIn: boolean }) {
  const destinations: readonly {
    description: string;
    icon: LucideIcon;
    label: string;
    to: string;
  }[] = [
    {
      icon: FileText,
      label: isSignedIn ? "Request a quotation" : "Create a buyer account",
      description: isSignedIn
        ? "Set out the quantities you need and collect written quotations from suppliers."
        : "Register to send requests for quotation, track orders and keep a wishlist.",
      to: isSignedIn ? "/rfqs/new" : "/register",
    },
    {
      icon: UsersRound,
      label: "Find a professional",
      description:
        "Browse the professionals who have published a profile on CMM.",
      to: "/professionals",
    },
    {
      icon: HardHat,
      label: "Browse projects",
      description:
        "See the construction projects professionals have published on CMM.",
      to: "/projects",
    },
  ];

  return (
    <section className="mt-14 border-t border-zinc-200 bg-sunken py-12 sm:mt-16 sm:py-16">
      <div className={CONTAINER}>
        <SectionHeading eyebrow="Also on CMM" title="More ways to buy" />
        <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {destinations.map(({ description, icon: Icon, label, to }) => (
            <li key={label}>
              <Link
                className="group flex h-full items-start gap-3 rounded-md border border-zinc-200 bg-white p-5 transition-colors hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring"
                to={to}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand text-on-brand">
                  <Icon aria-hidden="true" className="size-5" strokeWidth={1.9} />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-950">
                    {label}
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 shrink-0 text-brand-ink transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-zinc-600">
                    {description}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
