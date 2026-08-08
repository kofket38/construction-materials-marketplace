import { LoaderCircle, Save, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import type { Product } from "@/features/products/model/product";
import type { UpdateSellerInventoryProductInput } from "@/features/seller/model/seller-inventory";

interface InventoryEditDialogProps {
  isPending: boolean;
  onCancel: () => void;
  onSave: (input: UpdateSellerInventoryProductInput) => void;
  product: Product;
}

export function InventoryEditDialog({
  isPending,
  onCancel,
  onSave,
  product,
}: InventoryEditDialogProps) {
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(product.price);
  const [quantity, setQuantity] = useState(String(product.quantity));
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmedName = name.trim();
    const normalizedPrice = price.trim();
    const normalizedQuantity = Number(quantity);

    if (!trimmedName) {
      setError("Enter a product name.");
      return;
    }
    if (
      !/^\d{1,10}(?:\.\d{1,2})?$/.test(normalizedPrice) ||
      Number(normalizedPrice) <= 0
    ) {
      setError("Enter a valid price greater than zero.");
      return;
    }
    if (
      !Number.isInteger(normalizedQuantity) ||
      normalizedQuantity < 0
    ) {
      setError("Stock must be a non-negative whole number.");
      return;
    }

    setError(null);
    onSave({
      name: trimmedName,
      price: Number(normalizedPrice).toFixed(2),
      quantity: normalizedQuantity,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 px-4 py-8"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !isPending) {
          onCancel();
        }
      }}
    >
      <section
        aria-labelledby="inventory-edit-title"
        aria-modal="true"
        className="w-full max-w-lg rounded-md border border-zinc-200 bg-white p-6 shadow-xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-700">
              Inventory product
            </p>
            <h2
              className="mt-1 text-xl font-semibold text-zinc-950"
              id="inventory-edit-title"
            >
              Edit product
            </h2>
          </div>
          <button
            aria-label="Close product editor"
            className="inline-flex size-9 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 disabled:opacity-50"
            disabled={isPending}
            onClick={onCancel}
            title="Close"
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-zinc-800">
              Product name
            </span>
            <input
              className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
              disabled={isPending}
              maxLength={200}
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-zinc-800">
                Price
              </span>
              <input
                className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
                disabled={isPending}
                inputMode="decimal"
                onChange={(event) => setPrice(event.target.value)}
                value={price}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-800">
                Current stock
              </span>
              <input
                className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
                disabled={isPending}
                min="0"
                onChange={(event) => setQuantity(event.target.value)}
                type="number"
                value={quantity}
              />
            </label>
          </div>

          {error ? (
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 pt-5 sm:flex-row sm:justify-end">
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
              disabled={isPending}
              onClick={onCancel}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending}
              type="submit"
            >
              {isPending ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
              ) : (
                <Save aria-hidden="true" className="size-4" />
              )}
              {isPending ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
