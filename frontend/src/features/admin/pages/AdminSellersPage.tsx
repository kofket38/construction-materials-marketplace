import {
  AlertTriangle,
  LoaderCircle,
  Search,
  Store,
} from "lucide-react";
import {
  keepPreviousData,
  useQuery,
} from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import {
  getAdminSellers,
} from "@/features/admin/api/admin.api";
import { AdminPaginationBar } from "@/features/admin/components/AdminPagination";
import {
  formatAdminDate,
  statusBadgeClass,
} from "@/features/admin/lib/admin-display";
import { formatProductPrice } from "@/features/products/lib/product-display";
import { getApiErrorMessage } from "@/shared/api/http-error";

const PAGE_SIZE = 20;

export function AdminSellersPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const sellersQuery = useQuery({
    queryKey: ["admin", "sellers", { page, search }],
    queryFn: ({ signal }) =>
      getAdminSellers({ page, limit: PAGE_SIZE, search: search || undefined }, signal),
    placeholderData: keepPreviousData,
  });

  function handleSearch(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  const { sellers = [], pagination } = sellersQuery.data ?? {};

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Administration</p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">Sellers</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Seller accounts with shop info, product counts, and revenue.
          </p>
        </div>
        {pagination ? (
          <p className="text-sm text-zinc-600">
            {pagination.total.toLocaleString()} seller{pagination.total !== 1 ? "s" : ""}
          </p>
        ) : null}
      </div>

      {/* Search */}
      <form
        className="mt-5 flex gap-3 border-b border-zinc-200 pb-4"
        onSubmit={handleSearch}
        role="search"
      >
        <label className="relative flex-1">
          <span className="sr-only">Search sellers</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
          />
          <input
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white py-2 pl-10 pr-3 text-sm outline-none placeholder:text-zinc-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, email, shop name"
            type="search"
            value={searchInput}
          />
        </label>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          type="submit"
        >
          <Search aria-hidden="true" className="size-4" />
          Search
        </button>
      </form>

      {/* Content */}
      {sellersQuery.isPending ? (
        <div className="flex min-h-64 items-center justify-center">
          <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-emerald-700" />
        </div>
      ) : sellersQuery.isError ? (
        <div className="mt-6 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {getApiErrorMessage(sellersQuery.error, "Sellers could not be loaded.")}
        </div>
      ) : sellers.length === 0 ? (
        <div className="mt-8 py-16 text-center">
          <Store aria-hidden="true" className="mx-auto size-8 text-zinc-400" />
          <p className="mt-4 font-semibold text-zinc-950">No sellers found</p>
          <p className="mt-1 text-sm text-zinc-500">Try a different search term.</p>
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] border-collapse text-left text-sm">
              <thead className="bg-zinc-50">
                <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                  <th className="px-4 py-3 font-medium">Seller</th>
                  <th className="px-4 py-3 font-medium">Shop</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Products</th>
                  <th className="px-4 py-3 font-medium">Orders</th>
                  <th className="px-4 py-3 font-medium">Revenue</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {sellers.map((seller) => (
                  <tr className="hover:bg-zinc-50" key={seller.id}>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-zinc-950">{seller.name}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">{seller.email}</p>
                      {seller.company ? (
                        <p className="mt-0.5 text-xs text-zinc-400">{seller.company}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-zinc-950">
                        {seller.shopName ?? <span className="text-zinc-400">No profile</span>}
                      </p>
                      {seller.address ? (
                        <p className="mt-0.5 text-xs text-zinc-500">{seller.address}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(seller.status)}`}>
                        {seller.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-semibold text-zinc-950">
                      {seller.productCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 font-semibold text-zinc-950">
                      {seller.orderCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 font-semibold text-zinc-950">
                      {formatProductPrice(seller.revenue)}
                    </td>
                    <td className="px-4 py-4 text-zinc-600">
                      {formatAdminDate(seller.createdAt)}
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
    </div>
  );
}
