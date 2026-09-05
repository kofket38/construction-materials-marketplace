import {
  AlertTriangle,
  Boxes,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  MapPin,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
  TruckIcon,
} from "lucide-react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { ConfirmCartActionDialog } from "@/features/cart/components/ConfirmCartActionDialog";
import { ProductImage } from "@/features/products/components/ProductImage";
import { formatProductPrice } from "@/features/products/lib/product-display";
import {
  createSellerInventory,
  deleteSellerInventory,
  getSellerInventory,
  updateSellerInventory,
} from "@/features/seller/api/seller-inventory.api";
import { AddInventoryDialog } from "@/features/seller/components/AddInventoryDialog";
import { CreateProductDialog } from "@/features/seller/components/CreateProductDialog";
import { InventoryEditDialog } from "@/features/seller/components/InventoryEditDialog";
import { createProduct } from "@/features/seller/api/seller-products.api";
import type { CreateProductInput } from "@/features/seller/api/seller-products.api";
import type {
  CreateSellerInventoryInput,
  SellerInventoryEntry,
  UpdateSellerInventoryInput,
} from "@/features/seller/model/seller-inventory";
import { getApiErrorMessage } from "@/shared/api/http-error";
import { FullPageStatus } from "@/shared/ui/FullPageStatus";

const PAGE_SIZE = 20;
const LOW_STOCK_LIMIT = 10;

const updatedAtFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "short",
  year: "numeric",
});

export function SellerInventoryPage() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [cityFilter, setCityFilter] = useState("");

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingEntry, setEditingEntry] =
    useState<SellerInventoryEntry | null>(null);
  const [deletingEntry, setDeletingEntry] =
    useState<SellerInventoryEntry | null>(null);

  const inventoryQuery = useQuery({
    queryKey: ["seller", "inventory", { page, search, cityFilter }],
    queryFn: ({ signal }) =>
      getSellerInventory(
        {
          page,
          limit: PAGE_SIZE,
          ...(search ? { search } : {}),
          ...(cityFilter ? { city: cityFilter } : {}),
        },
        signal,
      ),
    placeholderData: keepPreviousData,
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["seller", "inventory"] });
    void queryClient.invalidateQueries({ queryKey: ["seller", "dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["products"] });
  }

  const addMutation = useMutation({
    mutationFn: (input: CreateSellerInventoryInput) =>
      createSellerInventory(input),
    onSuccess: () => {
      setShowAddDialog(false);
      invalidate();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSellerInventoryInput }) =>
      updateSellerInventory(id, input),
    onSuccess: () => {
      setEditingEntry(null);
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSellerInventory(id),
    onSuccess: () => {
      setDeletingEntry(null);
      if (inventoryQuery.data?.inventory.length === 1 && page > 1) {
        setPage((p) => p - 1);
      }
      invalidate();
    },
  });

  const createProductMutation = useMutation({
    mutationFn: (input: CreateProductInput) => createProduct(input),
    onSuccess: () => {
      setShowCreateDialog(false);
      // Invalidate the seller product list so AddInventoryDialog picks up the new product
      void queryClient.invalidateQueries({
        queryKey: ["seller", "products-for-inventory"],
      });
      void queryClient.invalidateQueries({ queryKey: ["seller", "dashboard"] });
    },
  });

  if (inventoryQuery.isPending) {
    return (
      <FullPageStatus
        description="Loading your inventory listings."
        icon={LoaderCircle}
        title="Loading inventory"
      />
    );
  }
  if (inventoryQuery.isError || !inventoryQuery.data) {
    return (
      <FullPageStatus
        action={{ label: "Try again", onClick: () => void inventoryQuery.refetch() }}
        description={getApiErrorMessage(
          inventoryQuery.error,
          "Inventory could not be loaded.",
        )}
        icon={AlertTriangle}
        title="Inventory unavailable"
      />
    );
  }

  const { inventory, pagination } = inventoryQuery.data;

  function handleSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      {/* ── Page header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-sm font-semibold text-brand-ink">
            Seller workspace
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">
            Inventory
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Manage your city-specific listings — price, stock, and delivery.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm text-zinc-600">
            {pagination.total.toLocaleString()}{" "}
            {pagination.total === 1 ? "listing" : "listings"}
          </p>
          <button
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
            onClick={() => {
              createProductMutation.reset();
              setShowCreateDialog(true);
            }}
            type="button"
          >
            <PackagePlus aria-hidden="true" className="size-4" />
            New product
          </button>
          <button
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring"
            onClick={() => {
              addMutation.reset();
              setShowAddDialog(true);
            }}
            type="button"
          >
            <Plus aria-hidden="true" className="size-4" />
            Add listing
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <form
        className="mt-6 grid gap-3 border-y border-zinc-200 py-4 sm:grid-cols-[minmax(14rem,1fr)_14rem_auto]"
        onSubmit={handleSearch}
        role="search"
      >
        <label className="relative">
          <span className="sr-only">Search by product name</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
          />
          <input
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white py-2 pl-10 pr-3 text-sm outline-none placeholder:text-zinc-400 focus:border-brand focus:ring-2 focus:ring-brand-ring/15"
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search product name"
            type="search"
            value={searchInput}
          />
        </label>
        <label>
          <span className="sr-only">Filter by city</span>
          <input
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-brand focus:ring-2 focus:ring-brand-ring/15"
            onChange={(e) => {
              setCityFilter(e.target.value);
              setPage(1);
            }}
            placeholder="Filter by city"
            value={cityFilter}
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

      {/* ── Mutation error banner ── */}
      {(addMutation.error ?? updateMutation.error ?? deleteMutation.error) ? (
        <div
          className="mt-5 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          {getApiErrorMessage(
            addMutation.error ?? updateMutation.error ?? deleteMutation.error,
            "The inventory listing could not be saved.",
          )}
        </div>
      ) : null}

      {/* ── Table ── */}
      {inventory.length === 0 ? (
        <section className="py-20 text-center">
          <Boxes
            aria-hidden="true"
            className="mx-auto size-8 text-zinc-400"
          />
          <h2 className="mt-4 text-lg font-semibold text-zinc-950">
            No inventory listings yet
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Add your first listing to start selling.
          </p>
          <button
            className="mt-6 inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-brand px-5 py-2 text-sm font-semibold text-on-brand hover:bg-brand-hover"
            onClick={() => {
              addMutation.reset();
              setShowAddDialog(true);
            }}
            type="button"
          >
            <Plus aria-hidden="true" className="size-4" />
            Add inventory listing
          </button>
        </section>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-md border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
            <thead className="bg-zinc-50">
              <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Delivery</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {inventory.map((entry) => (
                <InventoryRow
                  entry={entry}
                  key={entry.id}
                  onDelete={() => {
                    deleteMutation.reset();
                    setDeletingEntry(entry);
                  }}
                  onEdit={() => {
                    updateMutation.reset();
                    setEditingEntry(entry);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ── */}
      {pagination.totalPages > 1 ? (
        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="text-sm text-zinc-600">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              aria-label="Previous page"
              className="inline-flex size-10 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              type="button"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
            <button
              aria-label="Next page"
              className="inline-flex size-10 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
              type="button"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Add dialog ── */}
      {showAddDialog ? (
        <AddInventoryDialog
          isPending={addMutation.isPending}
          key="add-inventory"
          onCancel={() => {
            if (!addMutation.isPending) {
              setShowAddDialog(false);
              addMutation.reset();
            }
          }}
          onSave={(input) => addMutation.mutate(input)}
          serverError={
            addMutation.isError
              ? getApiErrorMessage(
                  addMutation.error,
                  "The listing could not be created.",
                )
              : null
          }
        />
      ) : null}

      {/* ── Edit dialog ── */}
      {editingEntry ? (
        <InventoryEditDialog
          entry={editingEntry}
          isPending={updateMutation.isPending}
          key={editingEntry.id}
          onCancel={() => {
            if (!updateMutation.isPending) {
              setEditingEntry(null);
              updateMutation.reset();
            }
          }}
          onSave={(input) =>
            updateMutation.mutate({ id: editingEntry.id, input })
          }
          serverError={
            updateMutation.isError
              ? getApiErrorMessage(
                  updateMutation.error,
                  "The listing could not be updated.",
                )
              : null
          }
        />
      ) : null}

      {/* ── Delete confirm ── */}
      <ConfirmCartActionDialog
        actionLabel="Delete listing"
        description={
          deletingEntry
            ? `Remove the inventory listing for "${deletingEntry.productName}" in ${deletingEntry.city}? This does not delete the product itself.`
            : ""
        }
        isOpen={Boolean(deletingEntry)}
        isPending={deleteMutation.isPending}
        onCancel={() => {
          if (!deleteMutation.isPending) {
            setDeletingEntry(null);
            deleteMutation.reset();
          }
        }}
        onConfirm={() => {
          if (deletingEntry) {
            deleteMutation.mutate(deletingEntry.id);
          }
        }}
        title="Remove inventory listing"
      />

      {/* ── Create product dialog ── */}
      {showCreateDialog ? (
        <CreateProductDialog
          isPending={createProductMutation.isPending}
          key="create-product"
          onCancel={() => {
            if (!createProductMutation.isPending) {
              setShowCreateDialog(false);
              createProductMutation.reset();
            }
          }}
          onSave={(input) => createProductMutation.mutate(input)}
          serverError={
            createProductMutation.isError
              ? getApiErrorMessage(
                  createProductMutation.error,
                  "The product could not be created.",
                )
              : null
          }
        />
      ) : null}
    </main>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function InventoryRow({
  entry,
  onDelete,
  onEdit,
}: {
  entry: SellerInventoryEntry;
  onDelete: () => void;
  onEdit: () => void;
}) {
  return (
    <tr className="hover:bg-zinc-50">
      {/* Product */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md">
            <ProductImage
              decorative
              fit="cover"
              imageUrl={entry.productImageUrl}
              name={entry.productName}
              size="xs"
            />
          </div>
          <p className="max-w-48 font-medium text-zinc-950 leading-5">
            {entry.productName}
          </p>
        </div>
      </td>

      {/* City */}
      <td className="px-4 py-4">
        <p className="flex items-center gap-1.5 text-zinc-700">
          <MapPin aria-hidden="true" className="size-3.5 shrink-0 text-zinc-400" />
          {entry.city}
          {entry.region ? (
            <span className="text-zinc-400">, {entry.region}</span>
          ) : null}
        </p>
      </td>

      {/* Price */}
      <td className="px-4 py-4 font-semibold text-zinc-950">
        {formatProductPrice(entry.price)}
      </td>

      {/* Stock */}
      <td className="px-4 py-4">
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-zinc-950">
            {entry.quantity.toLocaleString()}
          </span>
          <StockBadge quantity={entry.quantity} />
        </div>
      </td>

      {/* Delivery */}
      <td className="px-4 py-4">
        {entry.deliveryAvailable ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success-line bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
            <Truck aria-hidden="true" className="size-3" />
            Available
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-600">
            <TruckIcon aria-hidden="true" className="size-3" />
            Not available
          </span>
        )}
      </td>

      {/* Updated */}
      <td className="px-4 py-4 text-sm text-zinc-500">
        {formatDate(entry.updatedAt)}
      </td>

      {/* Actions */}
      <td className="px-4 py-4">
        <div className="flex justify-end gap-2">
          <button
            aria-label={`Edit listing for ${entry.productName}`}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            onClick={onEdit}
            type="button"
          >
            <Pencil aria-hidden="true" className="size-3.5" />
            Edit
          </button>
          <button
            aria-label={`Delete listing for ${entry.productName}`}
            className="inline-flex size-9 items-center justify-center rounded-md border border-red-200 bg-white text-red-600 hover:bg-red-50"
            onClick={onDelete}
            title="Delete listing"
            type="button"
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function StockBadge({ quantity }: { quantity: number }) {
  if (quantity === 0) {
    return (
      <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800">
        Out of stock
      </span>
    );
  }
  if (quantity <= LOW_STOCK_LIMIT) {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
        Low stock
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-brand-line bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-ink">
      In stock
    </span>
  );
}

function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : updatedAtFormatter.format(d);
}
