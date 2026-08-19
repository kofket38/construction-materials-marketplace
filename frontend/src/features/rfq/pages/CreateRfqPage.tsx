import {
  AlertTriangle,
  ArrowLeft,
  LoaderCircle,
  Minus,
  Plus,
  Save,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { useAuthStore } from "@/features/auth/model/auth.store";
import { createRfq } from "@/features/rfq/api/rfq.api";
import { RFQ_UNIT_LABELS, RFQ_UNITS, type RfqItemInput, type RfqUnit } from "@/features/rfq/model/rfq";
import { getMarketplaceCategories } from "@/features/marketplace/api/marketplace.api";
import { getApiErrorMessage } from "@/shared/api/http-error";

function defaultItem(): RfqItemInput {
  return {
    categoryId: "",
    materialName: "",
    specifications: "",
    requestedQuantity: "",
    requestedUnit: "BAG",
  };
}

function futureIso(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export function CreateRfqPage() {
  const authStatus = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [expiresAt, setExpiresAt] = useState(futureIso(14));
  const [items, setItems] = useState<RfqItemInput[]>([defaultItem()]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: ({ signal }) => getMarketplaceCategories(signal),
    staleTime: 5 * 60_000,
  });

  const createMutation = useMutation({
    mutationFn: createRfq,
    onSuccess: (rfq) => navigate(`/rfqs/${rfq.id}`, { replace: true }),
  });

  if (authStatus !== "authenticated" || !user) {
    return <Navigate replace state={{ returnTo: "/rfqs/new" }} to="/login" />;
  }
  if (user.role !== "CUSTOMER") {
    return <Navigate replace to="/products" />;
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "Title is required.";
    if (!deliveryLocation.trim()) next.deliveryLocation = "Delivery location is required.";
    if (!expiresAt) next.expiresAt = "Expiry date is required.";
    else {
      const ms = new Date(expiresAt).getTime() - Date.now();
      if (ms < 24 * 60 * 60 * 1000) next.expiresAt = "Expiry must be at least 24 hours from now.";
      if (ms > 90 * 24 * 60 * 60 * 1000) next.expiresAt = "Expiry cannot exceed 90 days.";
    }
    items.forEach((item, i) => {
      if (!item.categoryId) next[`items.${i}.categoryId`] = "Select a category.";
      if (!item.materialName.trim()) next[`items.${i}.materialName`] = "Material name is required.";
      if (!/^\d{1,11}(?:\.\d{1,3})?$/.test(item.requestedQuantity) || Number(item.requestedQuantity) <= 0)
        next[`items.${i}.requestedQuantity`] = "Enter a positive quantity.";
      if (item.requestedUnit === "OTHER" && !item.customUnit?.trim())
        next[`items.${i}.customUnit`] = "Specify the unit.";
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate({
      title: title.trim(),
      deliveryLocation: deliveryLocation.trim(),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      expiresAt: new Date(expiresAt + "T23:59:59Z").toISOString(),
      items: items.map((item) => ({
        categoryId: item.categoryId,
        materialName: item.materialName.trim(),
        ...(item.specifications?.trim() ? { specifications: item.specifications.trim() } : {}),
        requestedQuantity: item.requestedQuantity,
        requestedUnit: item.requestedUnit,
        ...(item.requestedUnit === "OTHER" && item.customUnit?.trim()
          ? { customUnit: item.customUnit.trim() }
          : {}),
      })),
    });
  }

  function addItem() {
    if (items.length < 20) setItems((prev) => [...prev, defaultItem()]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, patch: Partial<RfqItemInput>) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  const categories = categoriesQuery.data ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <Link
        className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-950"
        to="/rfqs"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        My RFQs
      </Link>

      <div className="mt-4 border-b border-zinc-200 pb-6">
        <p className="text-sm font-semibold text-emerald-700">New request</p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">
          Create RFQ
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Describe your material needs and suppliers will respond with quotes.
        </p>
      </div>

      <form className="mt-6 space-y-6" noValidate onSubmit={handleSubmit}>
        {/* Title */}
        <FieldGroup error={errors.title} id="title" label="RFQ title" required>
          <input
            className={fieldClass(Boolean(errors.title))}
            disabled={createMutation.isPending}
            id="title"
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Bulk cement for Phase 2 foundation"
            value={title}
          />
        </FieldGroup>

        {/* Delivery location */}
        <FieldGroup error={errors.deliveryLocation} id="deliveryLocation" label="Delivery location" required>
          <input
            className={fieldClass(Boolean(errors.deliveryLocation))}
            disabled={createMutation.isPending}
            id="deliveryLocation"
            maxLength={500}
            onChange={(e) => setDeliveryLocation(e.target.value)}
            placeholder="e.g. Bole Road Construction Site, Addis Ababa"
            value={deliveryLocation}
          />
        </FieldGroup>

        {/* Expiry */}
        <FieldGroup error={errors.expiresAt} id="expiresAt" label="Quote deadline" required>
          <input
            className={fieldClass(Boolean(errors.expiresAt))}
            disabled={createMutation.isPending}
            id="expiresAt"
            min={futureIso(1)}
            onChange={(e) => setExpiresAt(e.target.value)}
            type="date"
            value={expiresAt}
          />
        </FieldGroup>

        {/* Notes */}
        <FieldGroup id="notes" label="Additional notes">
          <textarea
            className={fieldClass(false) + " resize-none"}
            disabled={createMutation.isPending}
            id="notes"
            maxLength={5000}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Special requirements, site access instructions, preferred brands…"
            rows={3}
            value={notes}
          />
        </FieldGroup>

        {/* Items */}
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-950">
              Material requirements{" "}
              <span className="text-sm font-normal text-zinc-500">
                ({items.length} / 20)
              </span>
            </h2>
            {items.length < 20 ? (
              <button
                className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                disabled={createMutation.isPending}
                onClick={addItem}
                type="button"
              >
                <Plus aria-hidden="true" className="size-4" />
                Add item
              </button>
            ) : null}
          </div>

          <div className="mt-4 space-y-5">
            {items.map((item, index) => (
              <RfqItemForm
                categories={categories}
                errors={errors}
                index={index}
                isPending={createMutation.isPending}
                item={item}
                key={index}
                onRemove={items.length > 1 ? () => removeItem(index) : undefined}
                onUpdate={(patch) => updateItem(index, patch)}
              />
            ))}
          </div>
        </section>

        {/* Error */}
        {createMutation.isError ? (
          <div
            className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {getApiErrorMessage(createMutation.error, "The RFQ could not be created.")}
          </div>
        ) : null}

        {/* Submit */}
        <div className="flex justify-end gap-3 border-t border-zinc-200 pt-6">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            to="/rfqs"
          >
            Cancel
          </Link>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
            disabled={createMutation.isPending}
            type="submit"
          >
            {createMutation.isPending ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Save aria-hidden="true" className="size-4" />
            )}
            {createMutation.isPending ? "Submitting…" : "Submit RFQ"}
          </button>
        </div>
      </form>
    </main>
  );
}

function RfqItemForm({
  categories,
  errors,
  index,
  isPending,
  item,
  onRemove,
  onUpdate,
}: {
  categories: Array<{ id: string; name: string }>;
  errors: Record<string, string>;
  index: number;
  isPending: boolean;
  item: RfqItemInput;
  onRemove?: () => void;
  onUpdate: (patch: Partial<RfqItemInput>) => void;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900">
          Item {index + 1}
        </h3>
        {onRemove ? (
          <button
            className="inline-flex size-8 items-center justify-center rounded-md text-red-500 hover:bg-red-50"
            disabled={isPending}
            onClick={onRemove}
            title="Remove item"
            type="button"
          >
            <Minus aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* Category */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-zinc-800" htmlFor={`category-${index}`}>
            Category <span className="text-red-600">*</span>
          </label>
          <select
            className={fieldClass(Boolean(errors[`items.${index}.categoryId`]))}
            disabled={isPending}
            id={`category-${index}`}
            onChange={(e) => onUpdate({ categoryId: e.target.value })}
            value={item.categoryId}
          >
            <option value="">— Select category —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {errors[`items.${index}.categoryId`] ? (
            <p className="mt-1 text-xs text-red-700">{errors[`items.${index}.categoryId`]}</p>
          ) : null}
        </div>

        {/* Material name */}
        <div>
          <label className="block text-sm font-medium text-zinc-800" htmlFor={`material-${index}`}>
            Material name <span className="text-red-600">*</span>
          </label>
          <input
            className={fieldClass(Boolean(errors[`items.${index}.materialName`]))}
            disabled={isPending}
            id={`material-${index}`}
            maxLength={200}
            onChange={(e) => onUpdate({ materialName: e.target.value })}
            placeholder="e.g. Portland Cement C42.5"
            value={item.materialName}
          />
          {errors[`items.${index}.materialName`] ? (
            <p className="mt-1 text-xs text-red-700">{errors[`items.${index}.materialName`]}</p>
          ) : null}
        </div>

        {/* Quantity + Unit */}
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <div>
            <label className="block text-sm font-medium text-zinc-800" htmlFor={`qty-${index}`}>
              Quantity <span className="text-red-600">*</span>
            </label>
            <input
              className={fieldClass(Boolean(errors[`items.${index}.requestedQuantity`]))}
              disabled={isPending}
              id={`qty-${index}`}
              inputMode="decimal"
              onChange={(e) => onUpdate({ requestedQuantity: e.target.value })}
              placeholder="100"
              value={item.requestedQuantity}
            />
            {errors[`items.${index}.requestedQuantity`] ? (
              <p className="mt-1 text-xs text-red-700">{errors[`items.${index}.requestedQuantity`]}</p>
            ) : null}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-800" htmlFor={`unit-${index}`}>
              Unit
            </label>
            <select
              className={fieldClass(false)}
              disabled={isPending}
              id={`unit-${index}`}
              onChange={(e) => onUpdate({ requestedUnit: e.target.value as RfqUnit })}
              value={item.requestedUnit}
            >
              {RFQ_UNITS.map((u) => (
                <option key={u} value={u}>{RFQ_UNIT_LABELS[u]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Custom unit */}
        {item.requestedUnit === "OTHER" ? (
          <div>
            <label className="block text-sm font-medium text-zinc-800" htmlFor={`customUnit-${index}`}>
              Custom unit <span className="text-red-600">*</span>
            </label>
            <input
              className={fieldClass(Boolean(errors[`items.${index}.customUnit`]))}
              disabled={isPending}
              id={`customUnit-${index}`}
              maxLength={50}
              onChange={(e) => onUpdate({ customUnit: e.target.value })}
              value={item.customUnit ?? ""}
            />
            {errors[`items.${index}.customUnit`] ? (
              <p className="mt-1 text-xs text-red-700">{errors[`items.${index}.customUnit`]}</p>
            ) : null}
          </div>
        ) : null}

        {/* Specifications */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-zinc-800" htmlFor={`specs-${index}`}>
            Specifications{" "}
            <span className="font-normal text-zinc-500">(optional)</span>
          </label>
          <textarea
            className={fieldClass(false) + " resize-none"}
            disabled={isPending}
            id={`specs-${index}`}
            maxLength={5000}
            onChange={(e) => onUpdate({ specifications: e.target.value })}
            placeholder="Grade, standard, packaging requirements, brand preferences…"
            rows={2}
            value={item.specifications ?? ""}
          />
        </div>
      </div>
    </div>
  );
}

function FieldGroup({
  children,
  error,
  id,
  label,
  required,
}: {
  children: React.ReactNode;
  error?: string;
  id: string;
  label: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-800" htmlFor={id}>
        {label}
        {required ? <span className="ml-0.5 text-red-600">*</span> : null}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? <p className="mt-1 text-xs text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}

function fieldClass(hasError: boolean): string {
  return [
    "min-h-11 w-full rounded-md border px-3 py-2 text-sm outline-none",
    "focus:ring-2 focus:ring-emerald-700/15 disabled:opacity-60",
    hasError
      ? "border-red-400 focus:border-red-500"
      : "border-zinc-300 focus:border-emerald-700",
  ].join(" ");
}
