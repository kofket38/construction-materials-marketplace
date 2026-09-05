import {
  AlertTriangle,
  Banknote,
  Check,
  Copy,
  LoaderCircle,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { useController, useFormContext } from "react-hook-form";

import type { PaymentDestination } from "@/features/checkout/api/orders.api";
import { PaymentProofUpload } from "@/features/checkout/components/PaymentProofUpload";
import type {
  CheckoutFormValues,
  CheckoutPaymentMethod,
  ManualPaymentMethod,
} from "@/features/checkout/model/checkout.schema";
import { formatProductPrice } from "@/features/products/lib/product-display";

interface ProviderDefinition {
  label: string;
  method: CheckoutPaymentMethod;
  note: string;
}

const providers = [
  {
    method: "CASH_ON_DELIVERY",
    label: "Cash on Delivery",
    note: "Pay when your materials arrive",
  },
  {
    method: "TELEBIRR",
    label: "Telebirr",
    note: "Mobile wallet",
  },
  {
    method: "CBE_BIRR",
    label: "CBE Birr",
    note: "Mobile wallet",
  },
  {
    method: "CBE_BANK",
    label: "CBE Bank",
    note: "Bank transfer",
  },
  {
    method: "AWASH_BANK",
    label: "Awash Bank",
    note: "Bank transfer",
  },
  {
    method: "DASHEN_BANK",
    label: "Dashen Bank",
    note: "Bank transfer",
  },
  {
    method: "E_BIRR",
    label: "E-birr",
    note: "Mobile wallet",
  },
] as const satisfies readonly ProviderDefinition[];

interface PaymentProvidersProps {
  amount: string;
  disabled?: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  onProofChange: (file: File | null) => void;
  paymentDestinations: PaymentDestination[];
  proofFile: File | null;
  seller: {
    name: string;
    phone: string;
  } | null;
  unavailableMessage?: string;
}

export function PaymentProviders({
  amount,
  disabled = false,
  isLoading,
  isSubmitting,
  onProofChange,
  paymentDestinations,
  proofFile,
  seller,
  unavailableMessage,
}: PaymentProvidersProps) {
  const [copied, setCopied] = useState(false);
  const {
    control,
    formState: { errors },
  } = useFormContext<CheckoutFormValues>();
  const { field } = useController({
    control,
    name: "paymentMethod",
  });
  const selectedMethod = field.value;
  const selectedDestination = paymentDestinations.find(
    (destination) => destination.method === selectedMethod,
  );

  return (
    <section aria-labelledby="payment-provider-heading" className="pt-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-brand-ink">
            Payment
          </p>
          <h2
            className="mt-1 text-xl font-semibold text-zinc-950"
            id="payment-provider-heading"
          >
            Choose a payment provider
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Select a provider configured by the seller for this order.
          </p>
        </div>
        {isLoading ? (
          <LoaderCircle
            aria-label="Loading seller payment providers"
            className="mt-1 size-5 shrink-0 animate-spin text-brand-ink"
          />
        ) : null}
      </div>

      <fieldset
        aria-describedby={
          errors.paymentMethod ? "payment-provider-error" : undefined
        }
        aria-invalid={Boolean(errors.paymentMethod)}
        className="mt-6"
        disabled={disabled || isSubmitting}
      >
        <legend className="sr-only">Payment providers</legend>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {providers.map((provider) => {
            const isCash = provider.method === "CASH_ON_DELIVERY";
            const available =
              isCash ||
              paymentDestinations.some(
                (destination) => destination.method === provider.method,
              );
            const selected = selectedMethod === provider.method;

            return (
              <label
                className={`relative flex min-h-32 flex-col items-center justify-center border p-3 text-center transition-colors ${
                  selected
                    ? "border-brand bg-brand-soft shadow-[inset_0_0_0_1px_#047857]"
                    : available
                      ? "cursor-pointer border-zinc-200 bg-white hover:border-zinc-400"
                      : "cursor-not-allowed border-zinc-200 bg-zinc-50 opacity-55"
                } rounded-md`}
                htmlFor={`payment-provider-${provider.method.toLowerCase()}`}
                key={provider.method}
              >
                <input
                  checked={selected}
                  className="sr-only"
                  disabled={!available}
                  id={`payment-provider-${provider.method.toLowerCase()}`}
                  name={field.name}
                  onBlur={field.onBlur}
                  onChange={() => {
                    field.onChange(provider.method);
                    onProofChange(null);
                    setCopied(false);
                  }}
                  ref={isCash ? field.ref : undefined}
                  type="radio"
                  value={provider.method}
                />
                <ProviderMark method={provider.method} />
                <span className="mt-3 text-sm font-semibold text-zinc-900">
                  {provider.label}
                </span>
                <span className="mt-1 text-xs leading-4 text-zinc-500">
                  {available ? provider.note : "Not configured"}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {errors.paymentMethod?.message ? (
        <p
          className="mt-2 text-sm text-red-700"
          id="payment-provider-error"
          role="alert"
        >
          {errors.paymentMethod.message}
        </p>
      ) : null}

      {unavailableMessage ? (
        <div className="mt-4 flex items-start gap-2 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          <p>{unavailableMessage}</p>
        </div>
      ) : null}

      {selectedMethod === "CASH_ON_DELIVERY" ? (
        <div className="mt-6 flex items-start gap-4 border-y border-zinc-200 bg-white py-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-ink">
            <Truck aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-zinc-950">
              Pay when your order arrives
            </h3>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              The delivery team will collect the full order amount upon
              delivery. Keep your phone available so the seller can
              coordinate delivery.
            </p>
          </div>
        </div>
      ) : null}

      {selectedMethod &&
      selectedMethod !== "CASH_ON_DELIVERY" &&
      selectedDestination ? (
        <div className="mt-6 border-y border-zinc-200 bg-zinc-50 py-6">
          <div className="flex flex-col gap-5 px-4 sm:px-6">
            <div className="flex items-center gap-4">
              <ProviderMark large method={selectedDestination.method} />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-brand-ink">
                  Transfer to seller
                </p>
                <h3 className="mt-1 text-lg font-semibold text-zinc-950">
                  {selectedDestination.providerName}
                </h3>
                <p className="mt-1 truncate text-sm text-zinc-600">
                  {seller?.name ?? selectedDestination.accountName}
                </p>
              </div>
              <ShieldCheck
                aria-label="Seller payment details verified by CMM"
                className="ml-auto size-5 shrink-0 text-success"
              />
            </div>

            <dl className="grid border-y border-zinc-200 bg-white sm:grid-cols-2">
              <PaymentDetail
                label="Account name"
                value={selectedDestination.accountName}
              />
              <PaymentDetail
                label="Seller contact"
                value={seller?.phone || "Not provided"}
              />
              <div className="border-t border-zinc-200 p-4 sm:border-r">
                <dt className="text-xs font-medium text-zinc-500">
                  {selectedDestination.accountNumberLabel}
                </dt>
                <dd className="mt-2 flex items-center justify-between gap-3">
                  <span className="break-all text-base font-semibold text-zinc-950">
                    {selectedDestination.accountNumber}
                  </span>
                  <button
                    aria-label={`Copy ${selectedDestination.accountNumberLabel.toLowerCase()}`}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
                    onClick={() => {
                      void copyText(selectedDestination.accountNumber).then(
                        () => {
                          setCopied(true);
                          window.setTimeout(() => setCopied(false), 2000);
                        },
                      );
                    }}
                    title="Copy payment number"
                    type="button"
                  >
                    {copied ? (
                      <Check aria-hidden="true" className="size-4" />
                    ) : (
                      <Copy aria-hidden="true" className="size-4" />
                    )}
                  </button>
                </dd>
              </div>
              <PaymentDetail
                label="Order amount"
                value={formatProductPrice(amount)}
              />
            </dl>

            <div>
              <p className="text-xs font-medium text-zinc-500">
                Payment reference
              </p>
              <p className="mt-1 text-sm font-medium text-zinc-700">
                Your order ID will be used as the payment reference.
              </p>
            </div>

            <PaymentProofUpload
              disabled={isSubmitting}
              file={proofFile}
              onChange={onProofChange}
            />

            <button
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-brand px-5 py-3 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:self-end"
              disabled={!proofFile || isSubmitting}
              type="submit"
            >
              {isSubmitting ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
              ) : (
                <ShieldCheck aria-hidden="true" className="size-4" />
              )}
              {isSubmitting
                ? "Submitting payment..."
                : "Submit Payment Proof"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PaymentDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 first:border-r first:border-zinc-200">
      <dt className="text-xs font-medium text-zinc-500">{label}</dt>
      <dd className="mt-2 break-words text-sm font-semibold text-zinc-950">
        {value}
      </dd>
    </div>
  );
}

function ProviderMark({
  large = false,
  method,
}: {
  large?: boolean;
  method: CheckoutPaymentMethod;
}) {
  const size = large ? "h-14 w-20" : "h-10 w-16";
  const textSize = large ? "text-sm" : "text-xs";

  if (method === "CASH_ON_DELIVERY") {
    return (
      <span
        className={`flex ${size} items-center justify-center rounded-md bg-brand text-on-brand`}
      >
        <Banknote aria-hidden="true" className="size-6" />
      </span>
    );
  }

  // Provider brand marks. These stay fixed in both themes because they are the
  // institutions' own colours, not app tokens — but the darker shades below are
  // deliberate: each provider's published colour paired with its usual ink fell
  // between 4.08:1 and 4.38:1, under the 4.5:1 floor for the label text.
  const styles: Record<
    ManualPaymentMethod,
    { className: string; label: string }
  > = {
    TELEBIRR: {
      className: "bg-[#fff200] text-[#0a6b33]", // 5.67:1
      label: "telebirr",
    },
    CBE_BIRR: {
      className: "bg-[#702082] text-white", // 9.47:1
      label: "CBE Birr",
    },
    CBE_BANK: {
      className: "bg-[#f7c600] text-[#0b4a26]", // 6.45:1
      label: "CBE",
    },
    AWASH_BANK: {
      className: "bg-[#c41219] text-white", // 6.09:1
      label: "Awash",
    },
    DASHEN_BANK: {
      className: "bg-[#174ea6] text-white", // 7.85:1
      label: "Dashen",
    },
    E_BIRR: {
      className: "bg-[#0a7d5c] text-white", // 5.12:1
      label: "E-birr",
    },
  };
  const style = styles[method];

  return (
    <span
      aria-label={`${style.label} logo`}
      className={`flex ${size} items-center justify-center rounded-md px-2 ${textSize} font-bold ${style.className}`}
      role="img"
    >
      {style.label}
    </span>
  );
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall through to the browser-compatible copy path.
    }
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.append(textArea);
  textArea.select();
  document.execCommand("copy");
  textArea.remove();
}
