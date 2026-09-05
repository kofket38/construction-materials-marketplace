import { LoaderCircle, PackagePlus, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { getMarketplaceCategories } from "@/features/marketplace/api/marketplace.api";
import type { CreateProductInput } from "@/features/seller/api/seller-products.api";
import { getApiErrorMessage } from "@/shared/api/http-error";

interface CreateProductDialogProps {
  isPending: boolean;
  serverError?: string | null;
  onCancel: () => void;
  onSave: (input: CreateProductInput) => void;
}

interface FormErrors {
  name?: string;
  description?: string;
  categoryId?: string;
  price?: string;
  quantity?: string;
  imageUrl?: string;
}

export function CreateProductDialog({
  isPending,
  serverError,
  onCancel,
  onSave,
}: CreateProductDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [imageUrl, setImageUrl] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: ({ signal }) => getMarketplaceCategories(signal),
    staleTime: 5 * 60_000,
  });

  function validate(): boolean {
    const next: FormErrors = {};

    if (!name.trim()) {
      next.name = "Product name is required.";
    } else if (name.trim().length > 200) {
      next.name = "Name must be 200 characters or fewer.";
    }

    if (!description.trim()) {
      next.description = "Description is required.";
    } else if (description.trim().length > 5000) {
      next.description = "Description must be 5000 characters or fewer.";
    }

    if (!categoryId) {
      next.categoryId = "Select a category.";
    }

    if (
      !/^\d{1,10}(?:\.\d{1,2})?$/.test(price.trim()) ||
      Number(price) <= 0
    ) {
      next.price = "Enter a valid price greater than zero (e.g. 475.00).";
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 0) {
      next.quantity = "Quantity must be a non-negative whole number.";
    }

    if (imageUrl.trim()) {
      try {
        const protocol = new URL(imageUrl.trim()).protocol;
        if (protocol !== "http:" && protocol !== "https:") {
          next.imageUrl = "Image URL must use HTTP or HTTPS.";
        }
      } catch {
        next.imageUrl = "Enter a valid URL.";
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!validate()) return;

    onSave({
      name: name.trim(),
      description: description.trim(),
      categoryId,
      price: Number(price).toFixed(2),
      quantity: Number(quantity),
      imageUrl: imageUrl.trim() || null,
    });
  }

  const categories = categoriesQuery.data ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/45 px-4 py-8 overflow-y-auto"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !isPending) {
          onCancel();
        }
      }}
    >
      <section
        aria-labelledby="create-product-title"
        aria-modal="true"
        className="my-auto w-full max-w-lg rounded-md border border-zinc-200 bg-white p-6 shadow-xl"
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
              id="create-product-title"
            >
              New product
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              After creating the product, add it to your inventory with a
              city, price, and stock level.
            </p>
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
          {/* Name */}
          <div>
            <label
              className="block text-sm font-medium text-zinc-800"
              htmlFor="cp-name"
            >
              Product name
              <span aria-hidden="true" className="ml-0.5 text-red-600">*</span>
            </label>
            <input
              className={fieldClass(Boolean(errors.name))}
              disabled={isPending}
              id="cp-name"
              maxLength={200}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Portland Cement 50kg"
              value={name}
            />
            {errors.name ? (
              <p className="mt-1 text-xs text-red-700" role="alert">
                {errors.name}
              </p>
            ) : null}
          </div>

          {/* Description */}
          <div>
            <label
              className="block text-sm font-medium text-zinc-800"
              htmlFor="cp-description"
            >
              Description
              <span aria-hidden="true" className="ml-0.5 text-red-600">*</span>
            </label>
            <textarea
              className={fieldClass(Boolean(errors.description)) + " resize-none"}
              disabled={isPending}
              id="cp-description"
              maxLength={5000}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the product, grade, standard, packaging, etc."
              rows={3}
              value={description}
            />
            {errors.description ? (
              <p className="mt-1 text-xs text-red-700" role="alert">
                {errors.description}
              </p>
            ) : null}
          </div>

          {/* Category */}
          <div>
            <label
              className="block text-sm font-medium text-zinc-800"
              htmlFor="cp-category"
            >
              Category
              <span aria-hidden="true" className="ml-0.5 text-red-600">*</span>
            </label>
            {categoriesQuery.isPending ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-zinc-500">
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                Loading categories…
              </p>
            ) : categoriesQuery.isError ? (
              <p className="mt-2 text-sm text-red-700">
                {getApiErrorMessage(
                  categoriesQuery.error,
                  "Categories could not be loaded.",
                )}
              </p>
            ) : (
              <select
                className={fieldClass(Boolean(errors.categoryId))}
                disabled={isPending}
                id="cp-category"
                onChange={(e) => setCategoryId(e.target.value)}
                value={categoryId}
              >
                <option value="">— Select a category —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            {errors.categoryId ? (
              <p className="mt-1 text-xs text-red-700" role="alert">
                {errors.categoryId}
              </p>
            ) : null}
          </div>

          {/* Price + Quantity */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                className="block text-sm font-medium text-zinc-800"
                htmlFor="cp-price"
              >
                Default price (ETB)
                <span aria-hidden="true" className="ml-0.5 text-red-600">*</span>
              </label>
              <p className="mt-0.5 text-xs text-zinc-500">
                You can set city-specific prices in inventory.
              </p>
              <input
                className={fieldClass(Boolean(errors.price)) + " mt-1.5"}
                disabled={isPending}
                id="cp-price"
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
                htmlFor="cp-qty"
              >
                Initial stock
              </label>
              <p className="mt-0.5 text-xs text-zinc-500">
                Catalog default — set real stock in inventory.
              </p>
              <input
                className={fieldClass(Boolean(errors.quantity)) + " mt-1.5"}
                disabled={isPending}
                id="cp-qty"
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

          {/* Image URL (optional) */}
          <div>
            <label
              className="block text-sm font-medium text-zinc-800"
              htmlFor="cp-image"
            >
              Image URL{" "}
              <span className="font-normal text-zinc-500">(optional)</span>
            </label>
            <input
              className={fieldClass(Boolean(errors.imageUrl))}
              disabled={isPending}
              id="cp-image"
              inputMode="url"
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/product.jpg"
              type="url"
              value={imageUrl}
            />
            {errors.imageUrl ? (
              <p className="mt-1 text-xs text-red-700" role="alert">
                {errors.imageUrl}
              </p>
            ) : null}
          </div>

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
                <PackagePlus aria-hidden="true" className="size-4" />
              )}
              {isPending ? "Creating…" : "Create product"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function fieldClass(hasError: boolean): string {
  return [
    "min-h-11 w-full rounded-md border px-3 py-2 text-sm outline-none",
    "focus:ring-2 focus:ring-brand-ring/15 disabled:opacity-60",
    hasError
      ? "border-red-400 focus:border-red-500"
      : "border-zinc-300 focus:border-brand",
  ].join(" ");
}
