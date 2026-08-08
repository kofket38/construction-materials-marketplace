import { AlertTriangle, ArrowRight, PackageSearch } from "lucide-react";
import { Link } from "react-router-dom";

import { ProductCard } from "@/features/products/components/ProductCard";
import type { Product } from "@/features/products/model/product";

interface RelatedProductsProps {
  categoryId: string;
  categoryName: string;
  errorMessage: string | null;
  isLoading: boolean;
  onRetry: () => void;
  products: Product[];
}

export function RelatedProducts({
  categoryId,
  categoryName,
  errorMessage,
  isLoading,
  onRetry,
  products,
}: RelatedProductsProps) {
  const categorySearch = new URLSearchParams({ categoryId }).toString();

  return (
    <section
      aria-labelledby="related-products-heading"
      className="mt-14 border-t border-zinc-200 pt-10"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-700">
            More in {categoryName}
          </p>
          <h2
            className="mt-1 text-2xl font-semibold text-zinc-950"
            id="related-products-heading"
          >
            Related products
          </h2>
        </div>
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 transition-colors hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          to={`/products?${categorySearch}`}
        >
          View category
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>

      {isLoading ? (
        <div
          aria-label="Loading related products"
          className="mt-6 grid animate-pulse gap-5 sm:grid-cols-2 lg:grid-cols-4"
          role="status"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <div
              className="overflow-hidden rounded-md border border-zinc-200 bg-white"
              key={index}
            >
              <div className="aspect-[4/3] bg-zinc-200" />
              <div className="space-y-3 p-5">
                <div className="h-3 w-20 rounded bg-zinc-200" />
                <div className="h-5 w-4/5 rounded bg-zinc-200" />
                <div className="h-4 w-28 rounded bg-zinc-200" />
              </div>
            </div>
          ))}
        </div>
      ) : errorMessage ? (
        <div className="mt-6 flex items-start gap-3 border-y border-zinc-200 py-6">
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-red-700"
          />
          <div>
            <p className="text-sm font-semibold text-zinc-950">
              Related products could not be loaded
            </p>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              {errorMessage}
            </p>
            <button
              className="mt-3 text-sm font-semibold text-emerald-700 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              onClick={onRetry}
              type="button"
            >
              Try again
            </button>
          </div>
        </div>
      ) : products.length === 0 ? (
        <div className="mt-6 flex items-center gap-3 border-y border-zinc-200 py-7 text-sm text-zinc-600">
          <PackageSearch
            aria-hidden="true"
            className="size-5 shrink-0 text-zinc-400"
          />
          No other products are available in this category.
        </div>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
}
