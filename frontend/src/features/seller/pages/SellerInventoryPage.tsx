import {
  AlertTriangle,
  Boxes,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  LoaderCircle,
  PackageOpen,
  Pencil,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";

import { useAuthStore } from "@/features/auth/model/auth.store";
import { ConfirmCartActionDialog } from "@/features/cart/components/ConfirmCartActionDialog";
import type { Product } from "@/features/products/model/product";
import { formatProductPrice } from "@/features/products/lib/product-display";
import {
  deleteSellerInventoryProduct,
  getSellerInventory,
  updateSellerInventoryProduct,
} from "@/features/seller/api/seller-inventory.api";
import { InventoryEditDialog } from "@/features/seller/components/InventoryEditDialog";
import type {
  SellerInventoryStockFilter,
  SellerInventorySummary,
  UpdateSellerInventoryProductInput,
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
  const authStatus = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [stock, setStock] = useState<SellerInventoryStockFilter | "">("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const inventoryQuery = useQuery({
    queryKey: ["seller", "inventory", { page, search, stock }],
    enabled:
      authStatus === "authenticated" && user?.role === "SELLER",
    queryFn: ({ signal }) =>
      getSellerInventory(
        {
          page,
          limit: PAGE_SIZE,
          ...(search ? { search } : {}),
          ...(stock ? { stock } : {}),
        },
        signal,
      ),
    placeholderData: keepPreviousData,
  });
  const refreshInventory = () => {
    void queryClient.invalidateQueries({
      queryKey: ["seller", "inventory"],
    });
    void queryClient.invalidateQueries({
      queryKey: ["seller", "dashboard"],
    });
    void queryClient.invalidateQueries({
      queryKey: ["products"],
    });
  };
  const updateMutation = useMutation({
    mutationFn: ({
      productId,
      input,
    }: {
      productId: string;
      input: UpdateSellerInventoryProductInput;
    }) => updateSellerInventoryProduct(productId, input),
    onSuccess: () => {
      setEditingProduct(null);
      refreshInventory();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteSellerInventoryProduct,
    onSuccess: () => {
      setDeletingProduct(null);
      if (
        inventoryQuery.data?.products.length === 1 &&
        page > 1
      ) {
        setPage((current) => current - 1);
      }
      refreshInventory();
    },
  });

  if (authStatus !== "authenticated" || !user) {
    return (
      <Navigate
        replace
        state={{ returnTo: "/seller/inventory" }}
        to="/login"
      />
    );
  }
  if (user.role !== "SELLER") {
    return <Navigate replace to="/products" />;
  }
  if (inventoryQuery.isPending) {
    return (
      <FullPageStatus
        description="Loading seller inventory."
        icon={LoaderCircle}
        title="Loading inventory"
      />
    );
  }
  if (inventoryQuery.isError || !inventoryQuery.data) {
    return (
      <FullPageStatus
        action={{
          label: "Try again",
          onClick: () => void inventoryQuery.refetch(),
        }}
        description={getApiErrorMessage(
          inventoryQuery.error,
          "Inventory could not be loaded.",
        )}
        icon={AlertTriangle}
        title="Inventory unavailable"
      />
    );
  }

  const { inventorySummary, pagination, products } = inventoryQuery.data;
  const mutationError = updateMutation.error ?? deleteMutation.error;

  function handleSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-sm font-semibold text-emerald-700">
            Seller workspace
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">
            Inventory
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Current products, pricing, and available stock.
          </p>
        </div>
        <p className="text-sm text-zinc-600">
          {pagination.total.toLocaleString()} matching{" "}
          {pagination.total === 1 ? "product" : "products"}
        </p>
      </div>

      <InventorySummaryCards summary={inventorySummary} />

      <form
        className="mt-6 grid gap-3 border-y border-zinc-200 py-4 sm:grid-cols-[minmax(15rem,1fr)_13rem_auto]"
        onSubmit={handleSearch}
        role="search"
      >
        <label className="relative">
          <span className="sr-only">Search inventory</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
          />
          <input
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white py-2 pl-10 pr-3 text-sm outline-none placeholder:text-zinc-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search products"
            type="search"
            value={searchInput}
          />
        </label>
        <label>
          <span className="sr-only">Filter stock status</span>
          <select
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
            onChange={(event) => {
              setStock(
                event.target.value as SellerInventoryStockFilter | "",
              );
              setPage(1);
            }}
            value={stock}
          >
            <option value="">All stock statuses</option>
            <option value="in_stock">In stock</option>
            <option value="low_stock">Low stock</option>
            <option value="out_of_stock">Out of stock</option>
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

      {mutationError ? (
        <div
          className="mt-5 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          {getApiErrorMessage(
            mutationError,
            "The inventory product could not be updated.",
          )}
        </div>
      ) : null}

      {products.length === 0 ? (
        <section className="py-20 text-center">
          <PackageOpen
            aria-hidden="true"
            className="mx-auto size-8 text-zinc-400"
          />
          <h2 className="mt-4 text-lg font-semibold text-zinc-950">
            No matching products
          </h2>
        </section>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-md border border-zinc-200 bg-white shadow-sm">
          <table className="w-full min-w-[68rem] border-collapse text-left text-sm">
            <thead className="bg-zinc-50">
              <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Current Stock</th>
                <th className="px-4 py-3 font-medium">Stock Status</th>
                <th className="px-4 py-3 font-medium">Last Updated</th>
                <th className="px-4 py-3 text-right font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {products.map((product) => (
                <InventoryRow
                  key={product.id}
                  onDelete={() => setDeletingProduct(product)}
                  onEdit={() => setEditingProduct(product)}
                  product={product}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 ? (
        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="text-sm text-zinc-600">
            Page {pagination.page.toLocaleString()} of{" "}
            {pagination.totalPages.toLocaleString()}
          </p>
          <div className="flex gap-2">
            <button
              aria-label="Previous page"
              className="inline-flex size-10 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
              title="Previous page"
              type="button"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </button>
            <button
              aria-label="Next page"
              className="inline-flex size-10 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((current) => current + 1)}
              title="Next page"
              type="button"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
      ) : null}

      {editingProduct ? (
        <InventoryEditDialog
          isPending={updateMutation.isPending}
          key={editingProduct.id}
          onCancel={() => {
            if (!updateMutation.isPending) {
              setEditingProduct(null);
              updateMutation.reset();
            }
          }}
          onSave={(input) =>
            updateMutation.mutate({
              productId: editingProduct.id,
              input,
            })
          }
          product={editingProduct}
        />
      ) : null}

      <ConfirmCartActionDialog
        actionLabel="Delete product"
        description={
          deletingProduct
            ? `Delete ${deletingProduct.name} from your inventory? Products already used in orders cannot be deleted.`
            : ""
        }
        isOpen={Boolean(deletingProduct)}
        isPending={deleteMutation.isPending}
        onCancel={() => {
          if (!deleteMutation.isPending) {
            setDeletingProduct(null);
            deleteMutation.reset();
          }
        }}
        onConfirm={() => {
          if (deletingProduct) {
            deleteMutation.mutate(deletingProduct.id);
          }
        }}
        title="Delete inventory product"
      />
    </main>
  );
}

function InventorySummaryCards({
  summary,
}: {
  summary: SellerInventorySummary;
}) {
  const cards = [
    {
      icon: Boxes,
      label: "Total Products",
      value: summary.totalProducts.toLocaleString(),
      tone: "bg-zinc-100 text-zinc-700",
    },
    {
      icon: TriangleAlert,
      label: "Low Stock",
      value: summary.lowStock.toLocaleString(),
      tone: "bg-amber-50 text-amber-700",
    },
    {
      icon: PackageOpen,
      label: "Out of Stock",
      value: summary.outOfStock.toLocaleString(),
      tone: "bg-red-50 text-red-700",
    },
    {
      icon: CircleDollarSign,
      label: "Inventory Value",
      value: formatProductPrice(summary.inventoryValue),
      tone: "bg-emerald-50 text-emerald-700",
    },
  ];

  return (
    <section
      aria-label="Inventory summary"
      className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      {cards.map(({ icon: Icon, label, tone, value }) => (
        <div
          className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm"
          key={label}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-zinc-600">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-950">
                {value}
              </p>
            </div>
            <span
              className={`flex size-9 items-center justify-center rounded-md ${tone}`}
            >
              <Icon aria-hidden="true" className="size-4" />
            </span>
          </div>
        </div>
      ))}
    </section>
  );
}

function InventoryRow({
  onDelete,
  onEdit,
  product,
}: {
  onDelete: () => void;
  onEdit: () => void;
  product: Product;
}) {
  return (
    <tr className="hover:bg-zinc-50">
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-100 text-zinc-400">
            {product.imageUrl ? (
              <img
                alt=""
                className="size-full object-cover"
                src={product.imageUrl}
              />
            ) : (
              <PackageOpen aria-hidden="true" className="size-5" />
            )}
          </div>
          <p className="max-w-64 font-semibold text-zinc-950">
            {product.name}
          </p>
        </div>
      </td>
      <td className="px-4 py-4 font-mono text-xs text-zinc-600">
        {product.sku?.trim() || "—"}
      </td>
      <td className="px-4 py-4 text-zinc-700">
        {product.category.name}
      </td>
      <td className="px-4 py-4 font-semibold text-zinc-950">
        {formatProductPrice(product.price)}
      </td>
      <td className="px-4 py-4 font-semibold text-zinc-950">
        {product.quantity.toLocaleString()}
      </td>
      <td className="px-4 py-4">
        <StockStatusBadge quantity={product.quantity} />
      </td>
      <td className="px-4 py-4 text-zinc-600">
        {formatUpdatedAt(product.updatedAt)}
      </td>
      <td className="px-4 py-4">
        <div className="flex justify-end gap-2">
          <button
            aria-label={`Edit ${product.name}`}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100"
            onClick={onEdit}
            type="button"
          >
            <Pencil aria-hidden="true" className="size-4" />
            Edit
          </button>
          <button
            aria-label={`Delete ${product.name}`}
            className="inline-flex size-10 items-center justify-center rounded-md border border-red-300 bg-white text-red-700 hover:bg-red-50"
            onClick={onDelete}
            title="Delete product"
            type="button"
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function StockStatusBadge({ quantity }: { quantity: number }) {
  const status =
    quantity === 0
      ? {
          label: "Out of stock",
          classes: "border-red-200 bg-red-50 text-red-800",
        }
      : quantity <= LOW_STOCK_LIMIT
        ? {
            label: "Low stock",
            classes: "border-amber-200 bg-amber-50 text-amber-800",
          }
        : {
            label: "In stock",
            classes: "border-emerald-200 bg-emerald-50 text-emerald-800",
          };

  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${status.classes}`}
    >
      {status.label}
    </span>
  );
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unavailable"
    : updatedAtFormatter.format(date);
}
