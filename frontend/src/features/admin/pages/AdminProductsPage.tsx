import {
  AlertTriangle,
  Boxes,
  LoaderCircle,
  PackageOpen,
  Search,
  Trash2,
} from "lucide-react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import {
  deleteAdminProduct,
  getAdminProducts,
  type AdminProduct,
} from "@/features/admin/api/admin.api";
import { AdminPaginationBar } from "@/features/admin/components/AdminPagination";
import { formatAdminDate } from "@/features/admin/lib/admin-display";
import { getMarketplaceCategories } from "@/features/marketplace/api/marketplace.api";
import { formatProductPrice } from "@/features/products/lib/product-display";
import { getApiErrorMessage } from "@/shared/api/http-error";

const PAGE_SIZE = 20;

export function AdminProductsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminProduct | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: ({ signal }) => getMarketplaceCategories(signal),
    staleTime: 5 * 60_000,
  });

  const productsQuery = useQuery({
    queryKey: ["admin", "products", { page, search, categoryId }],
    queryFn: ({ signal }) =>
      getAdminProducts(
        { page, limit: PAGE_SIZE, search: search || undefined, categoryId: categoryId || undefined },
        signal,
      ),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAdminProduct(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      // also invalidate buyer catalog
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      setDeleteTarget(null);
    },
  });

  function handleSearch(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  const { products = [], pagination } = productsQuery.data ?? {};
  const categories = categoriesQuery.data ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Administration</p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Products</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Browse and moderate the product catalog.
          </p>
        </div>
        {pagination ? (
          <p className="text-sm text-zinc-600">
            {pagination.total.toLocaleString()} product{pagination.total !== 1 ? "s" : ""}
          </p>
        ) : null}
      </div>

      {/* Filters */}
      <form
        className="mt-5 grid gap-3 border-b border-zinc-200 pb-4 sm:grid-cols-[minmax(14rem,1fr)_13rem_auto]"
        onSubmit={handleSearch}
        role="search"
      >
        <label className="relative">
          <span className="sr-only">Search products</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
          />
          <input
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white py-2 pl-10 pr-3 text-sm outline-none placeholder:text-zinc-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, description, seller"
            type="search"
            value={searchInput}
          />
        </label>
        <label>
          <span className="sr-only">Filter by category</span>
          <select
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
            onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
            value={categoryId}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          type="submit"
        >
          <Search aria-hidden="true" className="size-4" />
          Search
        </button>
      </form>

      {/* Mutation error */}
      {deleteMutation.isError ? (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {getApiErrorMessage(deleteMutation.error, "The product could not be deleted.")}
        </div>
      ) : null}

      {/* Content */}
      {productsQuery.isPending ? (
        <div className="flex min-h-64 items-center justify-center">
          <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-emerald-700" />
        </div>
      ) : productsQuery.isError ? (
        <div className="mt-6 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {getApiErrorMessage(productsQuery.error, "Products could not be loaded.")}
        </div>
      ) : products.length === 0 ? (
        <div className="mt-8 py-16 text-center">
          <Boxes aria-hidden="true" className="mx-auto size-8 text-zinc-400" />
          <p className="mt-4 font-semibold text-zinc-950">No products found</p>
          <p className="mt-1 text-sm text-zinc-500">Try a different search or category.</p>
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
              <thead className="bg-zinc-50">
                <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Seller</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Added</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {products.map((product) => (
                  <tr className="hover:bg-zinc-50" key={product.id}>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 text-zinc-400">
                          {product.imageUrl ? (
                            <img
                              alt=""
                              className="size-full object-cover"
                              src={product.imageUrl}
                            />
                          ) : (
                            <PackageOpen aria-hidden="true" className="size-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-zinc-950 line-clamp-1">{product.name}</p>
                          <p className="mt-0.5 text-xs text-zinc-400 font-mono">{product.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-zinc-700">
                      {product.category.name}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-zinc-950">
                        {product.seller.shopName ?? product.seller.name}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">{product.seller.email}</p>
                    </td>
                    <td className="px-4 py-4 font-semibold text-zinc-950">
                      {formatProductPrice(product.price)}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`font-semibold ${product.quantity === 0 ? "text-red-600" : "text-zinc-950"}`}>
                        {product.quantity.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-zinc-600">
                      {formatAdminDate(product.createdAt)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        aria-label={`Delete ${product.name}`}
                        className="inline-flex size-9 items-center justify-center rounded-md border border-red-200 bg-white text-red-600 hover:bg-red-50"
                        onClick={() => { deleteMutation.reset(); setDeleteTarget(product); }}
                        type="button"
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination ? (
            <AdminPaginationBar onPageChange={setPage} pagination={pagination} />
          ) : null}
        </div>
      )}

      {/* Delete confirm dialog */}
      {deleteTarget ? (
        <DeleteConfirmDialog
          isLoading={deleteMutation.isPending}
          onCancel={() => { if (!deleteMutation.isPending) { setDeleteTarget(null); deleteMutation.reset(); } }}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          product={deleteTarget}
        />
      ) : null}
    </div>
  );
}

function DeleteConfirmDialog({
  isLoading,
  onCancel,
  onConfirm,
  product,
}: {
  isLoading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  product: AdminProduct;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 px-4"
      onMouseDown={(e) => { if (e.currentTarget === e.target && !isLoading) onCancel(); }}
    >
      <div className="w-full max-w-sm rounded-md border border-zinc-200 bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-zinc-950">Delete product</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Permanently delete <strong>{product.name}</strong>? This cannot be undone. Products referenced by existing orders cannot be deleted.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            className="flex-1 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
            disabled={isLoading}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            disabled={isLoading}
            onClick={onConfirm}
            type="button"
          >
            {isLoading ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Trash2 aria-hidden="true" className="size-4" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
