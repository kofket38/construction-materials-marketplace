import { MapPin } from "lucide-react";
import {
  useFormContext,
  type UseFormRegisterReturn,
} from "react-hook-form";

import type { CheckoutFormValues } from "@/features/checkout/model/checkout.schema";

const inputClassName =
  "mt-2 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition-colors placeholder:text-zinc-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15";

export function CheckoutForm() {
  const {
    formState: { errors },
    register,
  } = useFormContext<CheckoutFormValues>();

  return (
    <section
      aria-labelledby="shipping-information-heading"
      className="border-b border-zinc-200 pb-8"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
          <MapPin aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2
            className="text-lg font-semibold text-zinc-950"
            id="shipping-information-heading"
          >
            Shipping information
          </h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            Enter the contact and delivery details for this order.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <FormField
          autoComplete="name"
          error={errors.fullName?.message}
          id="checkout-full-name"
          label="Full name"
          register={register("fullName")}
        />
        <FormField
          autoComplete="tel"
          error={errors.phone?.message}
          id="checkout-phone"
          label="Phone number"
          register={register("phone")}
          type="tel"
        />
        <FormField
          autoComplete="address-level2"
          className="sm:col-span-2"
          error={errors.city?.message}
          id="checkout-city"
          label="Region / city"
          register={register("city")}
        />
        <div className="sm:col-span-2">
          <label
            className="block text-sm font-medium text-zinc-800"
            htmlFor="checkout-address"
          >
            Delivery address
          </label>
          <textarea
            aria-describedby={
              errors.address ? "checkout-address-error" : undefined
            }
            aria-invalid={Boolean(errors.address)}
            autoComplete="street-address"
            className={`${inputClassName} min-h-24 resize-y`}
            id="checkout-address"
            rows={3}
            {...register("address")}
          />
          {errors.address?.message ? (
            <p
              className="mt-1.5 text-sm text-red-700"
              id="checkout-address-error"
            >
              {errors.address.message}
            </p>
          ) : null}
        </div>
        <div className="sm:col-span-2">
          <label
            className="block text-sm font-medium text-zinc-800"
            htmlFor="checkout-notes"
          >
            Additional notes{" "}
            <span className="font-normal text-zinc-500">(optional)</span>
          </label>
          <textarea
            aria-describedby={
              errors.notes ? "checkout-notes-error" : undefined
            }
            aria-invalid={Boolean(errors.notes)}
            className={`${inputClassName} min-h-24 resize-y`}
            id="checkout-notes"
            placeholder="Delivery instructions, site contact, or access details"
            rows={3}
            {...register("notes")}
          />
          {errors.notes?.message ? (
            <p
              className="mt-1.5 text-sm text-red-700"
              id="checkout-notes-error"
            >
              {errors.notes.message}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

interface FormFieldProps {
  autoComplete: string;
  className?: string;
  error?: string;
  id: string;
  label: string;
  register: UseFormRegisterReturn;
  type?: "tel" | "text";
}

function FormField({
  autoComplete,
  className,
  error,
  id,
  label,
  register,
  type = "text",
}: FormFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className={className}>
      <label
        className="block text-sm font-medium text-zinc-800"
        htmlFor={id}
      >
        {label}
      </label>
      <input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        autoComplete={autoComplete}
        className={inputClassName}
        id={id}
        type={type}
        {...register}
      />
      {error ? (
        <p className="mt-1.5 text-sm text-red-700" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
