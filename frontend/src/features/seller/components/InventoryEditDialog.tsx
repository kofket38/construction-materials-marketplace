import { LoaderCircle, Save, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import type { SellerInventoryEntry, UpdateSellerInventoryInput } from "@/features/seller/model/seller-inventory";

interface InventoryEditDialogProps {
  entry: SellerInventoryEntry;
  isPending: boolean;
  serverError?: string | null;
  onCancel: () => void;
  onSave: (input: UpdateSellerInventoryInput) => void;
}

interface FormErrors {
  city?: string;
  price?: string;
  quantity?: string;
}

export function InventoryEditDialog({
  entry,
  isPending,
  serverError,
  onCancel,
  onSave,
}: InventoryEditDialogProps) {
  const [city, setCity] = useState(entry.city);
  const [region, setRegion] = useState(entry.region ?? "");
  const [price, setPrice] = useState(entry.price);
  const [quantity, setQuantity] = useState(String(entry.quantity));
  const [deliveryAvailable, setDeliveryAvailable] = useState(
    entry.deliveryAvailable,
  );
  const [errors, setErrors] = useState<FormErrors>({});

  function validate(): boolean {
    const next: FormErrors = {};

    if (!city.trim()) {
      next.city = "City is required.";
    } else if (city.trim().length > 120) {
      next.city = "City must be 120 characters or fewer.";
    }
    if (
      !/^\d{1,10}(?:\.\d{1,2})?$/.test(price.trim()) ||
      Number(price) < 0
    ) {
      next.price = "Enter a valid price (e.g. 475.00).";
    }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 0) {
      next.quantity = "Quantity must be a non-negative whole number.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!validate()) return;

    onSave({
      city: city.trim(),
      region: region.trim() || null,
      price: Number(price).toFixed(2),
      quantity: Number(quantity),
      deliveryAvailable,
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
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-700">
              Inventory listing
            </p>
            <h2
              className="mt-1 text-xl font-semibold text-zinc-950"
              id="inventory-edit-title"
            >
              {entry.productName}
            </h2>
          </div>
          <button
            aria-label="Close"
            className="inline-flex size-9 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 disabled:opacity-50"
            disabled={isPending}
            onClick={onCancel}
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        <form className="mt-6 space-y-5" noValidate onSubmit={handleSubmit}>
          {/* City */}
          <div>
            <label
              className="block text-sm font-medium text-zinc-800"
              htmlFor="edit-city"
            >
              City
            </label>
            <input
              className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 disabled:opacity-60"
              disabled={isPending}
              id="edit-city"
              maxLength={120}
              onChange={(e) => setCity(e.target.value)}
              value={city}
            />
            {errors.city ? (
              <p className="mt-1 text-xs text-red-700" role="alert">
                {errors.city}
              </p>
            ) : null}
          </div>

          {/* Region */}
          <div>
            <label
              className="block text-sm font-medium text-zinc-800"
              htmlFor="edit-region"
            >
              Region{" "}
              <span className="font-normal text-zinc-500">(optional)</span>
            </label>
            <input
              className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 disabled:opacity-60"
              disabled={isPending}
              id="edit-region"
              maxLength={120}
              onChange={(e) => setRegion(e.target.value)}
              value={region}
            />
          </div>

          {/* Price + Quantity */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                className="block text-sm font-medium text-zinc-800"
                htmlFor="edit-price"
              >
                Price (ETB)
              </label>
              <input
                className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 disabled:opacity-60"
                disabled={isPending}
                id="edit-price"
                inputMode="decimal"
                onChange={(e) => setPrice(e.target.value)}
                value={price}
              />
              {errors.price ? (
                <p className="mt-1 text-xs text-red-700" role="alert">
                  {errors.price}
                </p>
              ) : null}
            </div>

            <div>
              <label
                className="block text-sm font-medium text-zinc-800"
                htmlFor="edit-qty"
              >
                Quantity
              </label>
              <input
                className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 disabled:opacity-60"
                disabled={isPending}
                id="edit-qty"
                min="0"
                onChange={(e) => setQuantity(e.target.value)}
                type="number"
                value={quantity}
              />
              {errors.quantity ? (
                <p className="mt-1 text-xs text-red-700" role="alert">
                  {errors.quantity}
                </p>
              ) : null}
            </div>
          </div>

          {/* Delivery */}
          <label className="flex cursor-pointer items-center gap-3">
            <input
              checked={deliveryAvailable}
              className="size-4 rounded border-zinc-300 text-emerald-700 focus:ring-emerald-700"
              disabled={isPending}
              onChange={(e) => setDeliveryAvailable(e.target.checked)}
              type="checkbox"
            />
            <span className="text-sm font-medium text-zinc-800">
              Delivery available for this listing
            </span>
          </label>

          {/* Server error */}
          {serverError ? (
            <p className="text-sm text-red-700" role="alert">
              {serverError}
            </p>
          ) : null}

          {/* Actions */}
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
              {isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
