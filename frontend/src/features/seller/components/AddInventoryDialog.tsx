import { LoaderCircle, Plus, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { getSellerProducts } from "@/features/seller/api/seller-inventory.api";
import type { CreateSellerInventoryInput } from "@/features/seller/model/seller-inventory";
import { getApiErrorMessage } from "@/shared/api/http-error";

interface AddInventoryDialogProps {
  isPending: boolean;
  serverError?: string | null;
  onCancel: () => void;
  onSave: (input: CreateSellerInventoryInput) => void;
}

interface FormErrors {
  productId?: string;
  city?: string;
  price?: string;
  quantity?: string;
}

export function AddInventoryDialog({
  isPending,
  serverError,
  onCancel,
  onSave,
}: AddInventoryDialogProps) {
  const [productId, setProductId] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Fetch the seller's own products to populate the product selector.
  const productsQuery = useQuery({
    queryKey: ["seller", "products-for-inventory"],
    queryFn: ({ signal }) =>
      getSellerProducts({ page: 1, limit: 100 }, signal),
    staleTime: 60_000,
  });

  function validate(): boolean {
    const next: FormErrors = {};

    if (!productId) {
      next.productId = "Select a product.";
    }
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
      productId,
      city: city.trim(),
      ...(region.trim() ? { region: region.trim() } : {}),
      price: Number(price).toFixed(2),
      quantity: Number(quantity),
      deliveryAvailable,
    });
  }

  const products = productsQuery.data?.products ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/45 px-4 py-8"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !isPending) {
          onCancel();
        }
      }}
    >
      <section
        aria-labelledby="add-inventory-title"
        aria-modal="true"
        className="w-full max-w-lg rounded-md border border-zinc-200 bg-white p-6 shadow-xl"
        role="dialog"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-brand-ink">
              Seller inventory
            </p>
            <h2
              className="mt-1 text-xl font-semibold text-zinc-950"
              id="add-inventory-title"
            >
              Add inventory listing
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

        <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
          {/* Product selector */}
          <div>
            <label
              className="block text-sm font-medium text-zinc-800"
              htmlFor="inv-product"
            >
              Product
            </label>
            {productsQuery.isPending ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-zinc-500">
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
                Loading products…
              </p>
            ) : productsQuery.isError ? (
              <p className="mt-2 text-sm text-red-700">
                {getApiErrorMessage(
                  productsQuery.error,
                  "Products could not be loaded.",
                )}
              </p>
            ) : (
              <select
                className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring/15 disabled:opacity-60"
                disabled={isPending}
                id="inv-product"
                onChange={(e) => setProductId(e.target.value)}
                value={productId}
              >
                <option value="">— Select a product —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            {errors.productId ? (
              <p className="mt-1 text-xs text-red-700" role="alert">
                {errors.productId}
              </p>
            ) : null}
          </div>

          {/* City */}
          <div>
            <label
              className="block text-sm font-medium text-zinc-800"
              htmlFor="inv-city"
            >
              City
            </label>
            <input
              className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring/15 disabled:opacity-60"
              disabled={isPending}
              id="inv-city"
              maxLength={120}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Addis Ababa"
              value={city}
            />
            {errors.city ? (
              <p className="mt-1 text-xs text-red-700" role="alert">
                {errors.city}
              </p>
            ) : null}
          </div>

          {/* Region (optional) */}
          <div>
            <label
              className="block text-sm font-medium text-zinc-800"
              htmlFor="inv-region"
            >
              Region{" "}
              <span className="font-normal text-zinc-500">(optional)</span>
            </label>
            <input
              className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring/15 disabled:opacity-60"
              disabled={isPending}
              id="inv-region"
              maxLength={120}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. Oromia"
              value={region}
            />
          </div>

          {/* Price + Quantity */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                className="block text-sm font-medium text-zinc-800"
                htmlFor="inv-price"
              >
                Price (ETB)
              </label>
              <input
                className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring/15 disabled:opacity-60"
                disabled={isPending}
                id="inv-price"
                inputMode="decimal"
                onChange={(e) => setPrice(e.target.value)}
                placeholder="475.00"
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
                htmlFor="inv-qty"
              >
                Quantity
              </label>
              <input
                className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring/15 disabled:opacity-60"
                disabled={isPending}
                id="inv-qty"
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
              className="size-4 rounded border-zinc-300 text-brand-ink focus:ring-brand-ring"
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
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-on-brand hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending}
              type="submit"
            >
              {isPending ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
              ) : (
                <Plus aria-hidden="true" className="size-4" />
              )}
              {isPending ? "Saving…" : "Add listing"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
