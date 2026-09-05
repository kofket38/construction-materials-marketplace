import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, MessageSquareQuote, X } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type {
  ProductQuoteRequestInput,
  RfqUnit,
} from "@/features/products/api/product-actions.api";
import type { ProductDetails } from "@/features/products/model/product";
import { getApiErrorMessage } from "@/shared/api/http-error";
import { defaultFormOptions } from "@/shared/forms/form-config";

const quoteUnits = [
  { label: "Bags", value: "BAG" },
  { label: "Kilograms", value: "KG" },
  { label: "Tonnes", value: "TONNE" },
  { label: "Litres", value: "LITRE" },
  { label: "Metres", value: "METRE" },
  { label: "Square metres", value: "SQUARE_METRE" },
  { label: "Cubic metres", value: "CUBIC_METRE" },
  { label: "Pieces", value: "PIECE" },
  { label: "Rolls", value: "ROLL" },
  { label: "Pallets", value: "PALLET" },
  { label: "Loads", value: "LOAD" },
] as const satisfies ReadonlyArray<{ label: string; value: RfqUnit }>;

const quoteRequestSchema = z.object({
  deliveryLocation: z
    .string()
    .trim()
    .min(1, "Enter the delivery location.")
    .max(500, "Delivery location must contain at most 500 characters."),
  expiresOn: z.string().min(1, "Choose a quote deadline."),
  notes: z
    .string()
    .trim()
    .max(5000, "Notes must contain at most 5,000 characters."),
  requestedQuantity: z
    .string()
    .trim()
    .regex(
      /^\d{1,11}(?:\.\d{1,3})?$/,
      "Enter a positive quantity with up to three decimal places.",
    )
    .refine(
      (value) => Number(value) > 0,
      "Requested quantity must be greater than zero.",
    ),
  requestedUnit: z.enum([
    "BAG",
    "KG",
    "TONNE",
    "LITRE",
    "METRE",
    "SQUARE_METRE",
    "CUBIC_METRE",
    "PIECE",
    "ROLL",
    "PALLET",
    "LOAD",
  ]),
});

type QuoteRequestFormValues = z.infer<typeof quoteRequestSchema>;

interface RequestQuoteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: ProductQuoteRequestInput) => Promise<void>;
  product: ProductDetails;
}

export function RequestQuoteDialog({
  isOpen,
  onClose,
  onSubmit,
  product,
}: RequestQuoteDialogProps) {
  const minimumQuoteDate = getDateInputValue(2);
  const maximumQuoteDate = getDateInputValue(89);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setError,
  } = useForm<QuoteRequestFormValues>({
    ...defaultFormOptions,
    defaultValues: {
      deliveryLocation: "",
      expiresOn: getDateInputValue(14),
      notes: "",
      requestedQuantity: getDefaultQuantity(product),
      requestedUnit: getDefaultUnit(product),
    },
    resolver: zodResolver(quoteRequestSchema),
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: globalThis.KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const submitQuoteRequest = handleSubmit(async (values) => {
    try {
      await onSubmit({
        deliveryLocation: values.deliveryLocation.trim(),
        expiresAt: new Date(
          `${values.expiresOn}T23:59:59`,
        ).toISOString(),
        ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
        product: {
          categoryId: product.categoryId,
          description: product.description,
          id: product.id,
          name: product.name,
        },
        requestedQuantity: values.requestedQuantity.trim(),
        requestedUnit: values.requestedUnit,
      });
      reset();
    } catch (error) {
      setError("root", {
        message: getApiErrorMessage(
          error,
          "The quote request could not be submitted. Please try again.",
        ),
      });
    }
  });

  return (
    <div
      aria-labelledby="quote-dialog-heading"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-scrim/55 p-0 sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
      role="dialog"
    >
      <section className="max-h-[92vh] w-full overflow-y-auto rounded-t-md bg-white shadow-xl sm:max-w-xl sm:rounded-md">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-5 sm:px-6">
          <div>
            <span className="flex size-10 items-center justify-center rounded-md bg-brand-soft text-brand-ink">
              <MessageSquareQuote aria-hidden="true" className="size-5" />
            </span>
            <h2
              className="mt-4 text-xl font-semibold text-zinc-950"
              id="quote-dialog-heading"
            >
              Request a supplier quote
            </h2>
            <p className="mt-1 max-w-md text-sm leading-6 text-zinc-600">
              {product.name}
            </p>
          </div>
          <button
            aria-label="Close quote request"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
            onClick={onClose}
            title="Close"
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <form
          className="grid gap-5 px-5 py-6 sm:grid-cols-2 sm:px-6"
          noValidate
          onSubmit={submitQuoteRequest}
        >
          {errors.root?.message ? (
            <div
              className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:col-span-2"
              role="alert"
            >
              {errors.root.message}
            </div>
          ) : null}

          <div>
            <label
              className="block text-sm font-medium text-zinc-800"
              htmlFor="requestedQuantity"
            >
              Quantity
            </label>
            <input
              aria-describedby={
                errors.requestedQuantity ? "quantity-error" : undefined
              }
              aria-invalid={Boolean(errors.requestedQuantity)}
              className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand-ring/15"
              id="requestedQuantity"
              inputMode="decimal"
              {...register("requestedQuantity")}
            />
            {errors.requestedQuantity?.message ? (
              <p className="mt-1.5 text-sm text-red-700" id="quantity-error">
                {errors.requestedQuantity.message}
              </p>
            ) : null}
          </div>

          <div>
            <label
              className="block text-sm font-medium text-zinc-800"
              htmlFor="requestedUnit"
            >
              Unit
            </label>
            <select
              className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand-ring/15"
              id="requestedUnit"
              {...register("requestedUnit")}
            >
              {quoteUnits.map((unit) => (
                <option key={unit.value} value={unit.value}>
                  {unit.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label
              className="block text-sm font-medium text-zinc-800"
              htmlFor="deliveryLocation"
            >
              Delivery location
            </label>
            <input
              aria-describedby={
                errors.deliveryLocation ? "delivery-location-error" : undefined
              }
              aria-invalid={Boolean(errors.deliveryLocation)}
              autoFocus
              className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand-ring/15"
              id="deliveryLocation"
              placeholder="City, district, or site address"
              {...register("deliveryLocation")}
            />
            {errors.deliveryLocation?.message ? (
              <p
                className="mt-1.5 text-sm text-red-700"
                id="delivery-location-error"
              >
                {errors.deliveryLocation.message}
              </p>
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <label
              className="block text-sm font-medium text-zinc-800"
              htmlFor="expiresOn"
            >
              Quote deadline
            </label>
            <input
              aria-describedby={
                errors.expiresOn ? "quote-deadline-error" : undefined
              }
              aria-invalid={Boolean(errors.expiresOn)}
              className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand-ring/15"
              id="expiresOn"
              max={maximumQuoteDate}
              min={minimumQuoteDate}
              type="date"
              {...register("expiresOn")}
            />
            {errors.expiresOn?.message ? (
              <p
                className="mt-1.5 text-sm text-red-700"
                id="quote-deadline-error"
              >
                {errors.expiresOn.message}
              </p>
            ) : null}
          </div>

          <div className="sm:col-span-2">
            <label
              className="block text-sm font-medium text-zinc-800"
              htmlFor="quoteNotes"
            >
              Notes{" "}
              <span className="font-normal text-zinc-500">(optional)</span>
            </label>
            <textarea
              aria-describedby={errors.notes ? "quote-notes-error" : undefined}
              aria-invalid={Boolean(errors.notes)}
              className="mt-2 min-h-28 w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm leading-6 text-zinc-950 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand-ring/15"
              id="quoteNotes"
              placeholder="Delivery timing, quality requirements, or other details"
              {...register("notes")}
            />
            {errors.notes?.message ? (
              <p className="mt-1.5 text-sm text-red-700" id="quote-notes-error">
                {errors.notes.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-zinc-200 pt-5 sm:col-span-2 sm:flex-row sm:justify-end">
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
              ) : (
                <MessageSquareQuote aria-hidden="true" className="size-4" />
              )}
              {isSubmitting ? "Submitting..." : "Submit request"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function getDateInputValue(daysFromToday: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultQuantity(product: ProductDetails): string {
  if (typeof product.minimumOrder === "number" && product.minimumOrder > 0) {
    return String(product.minimumOrder);
  }

  if (
    typeof product.minimumOrder === "string" &&
    /^\d{1,11}(?:\.\d{1,3})?$/.test(product.minimumOrder.trim())
  ) {
    return product.minimumOrder.trim();
  }

  return "1";
}

function getDefaultUnit(product: ProductDetails): RfqUnit {
  const packaging = product.packaging?.toLowerCase() ?? "";

  if (packaging.includes("bag")) {
    return "BAG";
  }
  if (packaging.includes("pallet")) {
    return "PALLET";
  }
  if (packaging.includes("roll")) {
    return "ROLL";
  }

  return "PIECE";
}
