import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  LoaderCircle,
  Save,
  Store,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  getSellerProfile,
  upsertSellerProfile,
} from "@/features/seller/api/seller-profile.api";
import { getApiErrorMessage } from "@/shared/api/http-error";
import { FullPageStatus } from "@/shared/ui/FullPageStatus";
import { defaultFormOptions, zodResolver } from "@/shared/forms/form-config";

// ── Validation schema ─────────────────────────────────────────────────────────

const profileSchema = z.object({
  shopName: z
    .string()
    .trim()
    .min(1, "Shop name is required.")
    .max(200, "Shop name is too long."),
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required.")
    .max(30, "Phone number is too long."),
  address: z
    .string()
    .trim()
    .min(1, "Address is required.")
    .max(500, "Address is too long."),
  paymentAccountName: z.string().trim().max(60).optional().or(z.literal("")),
  telebirrNumber: z.string().trim().max(60).optional().or(z.literal("")),
  cbeBirrNumber: z.string().trim().max(60).optional().or(z.literal("")),
  cbeBankAccountNumber: z.string().trim().max(60).optional().or(z.literal("")),
  awashBankAccountNumber: z
    .string()
    .trim()
    .max(60)
    .optional()
    .or(z.literal("")),
  dashenBankAccountNumber: z
    .string()
    .trim()
    .max(60)
    .optional()
    .or(z.literal("")),
  eBirrNumber: z.string().trim().max(60).optional().or(z.literal("")),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

// ── Page ──────────────────────────────────────────────────────────────────────

export function SellerProfilePage() {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["seller", "profile"],
    queryFn: ({ signal }) => getSellerProfile(signal),
    staleTime: 30_000,
  });

  const form = useForm<ProfileFormValues>({
    ...defaultFormOptions,
    resolver: zodResolver(profileSchema),
    defaultValues: {
      shopName: "",
      phone: "",
      address: "",
      paymentAccountName: "",
      telebirrNumber: "",
      cbeBirrNumber: "",
      cbeBankAccountNumber: "",
      awashBankAccountNumber: "",
      dashenBankAccountNumber: "",
      eBirrNumber: "",
    },
  });

  const { formState: { errors, isSubmitting, isDirty }, handleSubmit, reset, setError } = form;

  // Populate form once profile data loads
  useEffect(() => {
    if (profileQuery.data) {
      const p = profileQuery.data;
      reset({
        shopName: p.shopName,
        phone: p.phone,
        address: p.address,
        paymentAccountName: p.paymentAccountName ?? "",
        telebirrNumber: p.telebirrNumber ?? "",
        cbeBirrNumber: p.cbeBirrNumber ?? "",
        cbeBankAccountNumber: p.cbeBankAccountNumber ?? "",
        awashBankAccountNumber: p.awashBankAccountNumber ?? "",
        dashenBankAccountNumber: p.dashenBankAccountNumber ?? "",
        eBirrNumber: p.eBirrNumber ?? "",
      });
    }
  }, [profileQuery.data, reset]);

  const saveMutation = useMutation({
    mutationFn: upsertSellerProfile,
    onSuccess: (profile) => {
      void queryClient.invalidateQueries({ queryKey: ["seller", "profile"] });
      // Invalidate payment options cache so checkout picks up new account numbers
      void queryClient.invalidateQueries({ queryKey: ["checkout"] });
      reset({
        shopName: profile.shopName,
        phone: profile.phone,
        address: profile.address,
        paymentAccountName: profile.paymentAccountName ?? "",
        telebirrNumber: profile.telebirrNumber ?? "",
        cbeBirrNumber: profile.cbeBirrNumber ?? "",
        cbeBankAccountNumber: profile.cbeBankAccountNumber ?? "",
        awashBankAccountNumber: profile.awashBankAccountNumber ?? "",
        dashenBankAccountNumber: profile.dashenBankAccountNumber ?? "",
        eBirrNumber: profile.eBirrNumber ?? "",
      });
    },
    onError: (error) => {
      setError("root", {
        message: getApiErrorMessage(
          error,
          "The profile could not be saved. Please try again.",
        ),
      });
    },
  });

  if (profileQuery.isPending) {
    return (
      <FullPageStatus
        description="Loading store profile."
        icon={LoaderCircle}
        title="Loading profile"
      />
    );
  }
  if (profileQuery.isError) {
    return (
      <FullPageStatus
        action={{
          label: "Try again",
          onClick: () => void profileQuery.refetch(),
        }}
        description={getApiErrorMessage(
          profileQuery.error,
          "Store profile could not be loaded.",
        )}
        icon={AlertTriangle}
        title="Profile unavailable"
      />
    );
  }

  const isNewProfile = profileQuery.data === null;

  const onSubmit = handleSubmit((values) => {
    saveMutation.mutate({
      shopName: values.shopName,
      phone: values.phone,
      address: values.address,
      paymentAccountName: values.paymentAccountName || null,
      telebirrNumber: values.telebirrNumber || null,
      cbeBirrNumber: values.cbeBirrNumber || null,
      cbeBankAccountNumber: values.cbeBankAccountNumber || null,
      awashBankAccountNumber: values.awashBankAccountNumber || null,
      dashenBankAccountNumber: values.dashenBankAccountNumber || null,
      eBirrNumber: values.eBirrNumber || null,
    });
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      {/* Header */}
      <div className="border-b border-zinc-200 pb-6">
        <p className="text-sm font-semibold text-emerald-700">
          Seller workspace
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">
          Store profile
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          {isNewProfile
            ? "Set up your store so buyers can find you and make payments."
            : "Update your store details and payment account information."}
        </p>
      </div>

      {isNewProfile ? (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          <p>
            Your store profile is not set up yet. Fill in the form below to
            create it.
          </p>
        </div>
      ) : null}

      {saveMutation.isSuccess ? (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <BadgeCheck aria-hidden="true" className="size-4 shrink-0" />
          Store profile saved successfully.
        </div>
      ) : null}

      <form className="mt-6 space-y-8" noValidate onSubmit={onSubmit}>
        {/* ── Store information ─────────────────────────────────────────────── */}
        <section aria-labelledby="store-info-heading">
          <div className="flex items-center gap-2 pb-4">
            <Store aria-hidden="true" className="size-4 text-emerald-700" />
            <h2
              className="text-base font-semibold text-zinc-950"
              id="store-info-heading"
            >
              Store information
            </h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              error={errors.shopName?.message}
              id="shopName"
              label="Shop / store name"
              required
            >
              <input
                className={inputClass(Boolean(errors.shopName))}
                disabled={isSubmitting}
                id="shopName"
                maxLength={200}
                placeholder="e.g. Addis Construction Supplies"
                {...form.register("shopName")}
              />
            </Field>

            <Field
              error={errors.phone?.message}
              id="phone"
              label="Store phone"
              required
            >
              <input
                className={inputClass(Boolean(errors.phone))}
                disabled={isSubmitting}
                id="phone"
                maxLength={30}
                placeholder="+251 91 123 4567"
                type="tel"
                {...form.register("phone")}
              />
            </Field>

            <div className="sm:col-span-2">
              <Field
                error={errors.address?.message}
                id="address"
                label="Store address"
                required
              >
                <textarea
                  className={inputClass(Boolean(errors.address)) + " resize-none"}
                  disabled={isSubmitting}
                  id="address"
                  maxLength={500}
                  placeholder="Bole Road, Addis Ababa"
                  rows={2}
                  {...form.register("address")}
                />
              </Field>
            </div>
          </div>
        </section>

        {/* ── Payment accounts ─────────────────────────────────────────────── */}
        <section aria-labelledby="payment-accounts-heading">
          <div className="flex items-center gap-2 border-t border-zinc-200 pb-4 pt-6">
            <Banknote aria-hidden="true" className="size-4 text-emerald-700" />
            <h2
              className="text-base font-semibold text-zinc-950"
              id="payment-accounts-heading"
            >
              Payment accounts
            </h2>
          </div>
          <p className="mb-5 text-sm text-zinc-500">
            Account numbers buyers will use to pay you. Leave blank to disable
            a payment method.
          </p>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id="paymentAccountName"
              label="Account holder name"
              hint="Displayed on payment instructions"
            >
              <input
                className={inputClass(false)}
                disabled={isSubmitting}
                id="paymentAccountName"
                maxLength={60}
                placeholder="e.g. Addis Construction Supplies"
                {...form.register("paymentAccountName")}
              />
            </Field>

            <Field id="telebirrNumber" label="Telebirr number">
              <input
                className={inputClass(false)}
                disabled={isSubmitting}
                id="telebirrNumber"
                maxLength={60}
                placeholder="09xxxxxxxx"
                type="tel"
                {...form.register("telebirrNumber")}
              />
            </Field>

            <Field id="cbeBirrNumber" label="CBE Birr number">
              <input
                className={inputClass(false)}
                disabled={isSubmitting}
                id="cbeBirrNumber"
                maxLength={60}
                placeholder="09xxxxxxxx"
                type="tel"
                {...form.register("cbeBirrNumber")}
              />
            </Field>

            <Field id="cbeBankAccountNumber" label="CBE bank account">
              <input
                className={inputClass(false)}
                disabled={isSubmitting}
                id="cbeBankAccountNumber"
                maxLength={60}
                placeholder="1000xxxxxxxxx"
                {...form.register("cbeBankAccountNumber")}
              />
            </Field>

            <Field id="awashBankAccountNumber" label="Awash Bank account">
              <input
                className={inputClass(false)}
                disabled={isSubmitting}
                id="awashBankAccountNumber"
                maxLength={60}
                placeholder="0134xxxxxxxxx"
                {...form.register("awashBankAccountNumber")}
              />
            </Field>

            <Field id="dashenBankAccountNumber" label="Dashen Bank account">
              <input
                className={inputClass(false)}
                disabled={isSubmitting}
                id="dashenBankAccountNumber"
                maxLength={60}
                placeholder="1800xxxxxxxxx"
                {...form.register("dashenBankAccountNumber")}
              />
            </Field>

            <Field id="eBirrNumber" label="E-birr number">
              <input
                className={inputClass(false)}
                disabled={isSubmitting}
                id="eBirrNumber"
                maxLength={60}
                placeholder="09xxxxxxxx"
                type="tel"
                {...form.register("eBirrNumber")}
              />
            </Field>
          </div>
        </section>

        {/* ── Root error + submit ──────────────────────────────────────────── */}
        {errors.root?.message ? (
          <div
            className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            {errors.root.message}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-6">
          {isDirty && !isSubmitting ? (
            <p className="text-sm text-zinc-500">You have unsaved changes.</p>
          ) : null}
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            ) : (
              <Save aria-hidden="true" className="size-4" />
            )}
            {isSubmitting ? "Saving…" : isNewProfile ? "Create profile" : "Save changes"}
          </button>
        </div>
      </form>
    </main>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Field({
  children,
  error,
  hint,
  id,
  label,
  required,
}: {
  children: React.ReactNode;
  error?: string;
  hint?: string;
  id: string;
  label: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        className="block text-sm font-medium text-zinc-800"
        htmlFor={id}
      >
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-red-600">
            *
          </span>
        ) : null}
      </label>
      {hint ? (
        <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>
      ) : null}
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p className="mt-1 text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function inputClass(hasError: boolean): string {
  return [
    "min-h-11 w-full rounded-md border px-3 py-2 text-sm outline-none",
    "focus:ring-2 focus:ring-emerald-700/15 disabled:opacity-60",
    hasError
      ? "border-red-400 focus:border-red-500"
      : "border-zinc-300 focus:border-emerald-700",
  ].join(" ");
}
