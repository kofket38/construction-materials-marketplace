import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Landmark,
  LoaderCircle,
  PackageCheck,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  getManualPayment,
  submitManualPayment,
} from "@/features/checkout/api/payments.api";
import { PaymentProofUpload } from "@/features/checkout/components/PaymentProofUpload";
import { readManualPaymentInstructions } from "@/features/checkout/lib/bank-transfer-storage";
import { useAuthStore } from "@/features/auth/model/auth.store";
import { isBuyerRole } from "@/features/auth/model/auth.types";
import { formatProductPrice } from "@/features/products/lib/product-display";
import { getApiErrorMessage } from "@/shared/api/http-error";
import { FullPageStatus } from "@/shared/ui/FullPageStatus";

export function BankTransferDetailsPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const authStatus = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [copiedAccountNumber, setCopiedAccountNumber] = useState(false);
  const storedInstructions = useMemo(
    () => (orderId ? readManualPaymentInstructions(orderId) : null),
    [orderId],
  );

  const paymentQuery = useQuery({
    queryKey: ["payments", "manual", orderId],
    enabled:
      Boolean(orderId) &&
      authStatus === "authenticated" &&
      isBuyerRole(user?.role),
    queryFn: ({ signal }) => {
      if (!orderId) {
        throw new Error("An order ID is required.");
      }
      return getManualPayment(orderId, signal);
    },
  });
  const paymentDestination =
    paymentQuery.data?.paymentDestination ??
    storedInstructions?.paymentDestination;
  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!orderId || !proofFile) {
        throw new Error("Upload your payment screenshot.");
      }

      return submitManualPayment(orderId, proofFile);
    },
    onSuccess: async () => {
      setProofFile(null);
      await queryClient.invalidateQueries({
        queryKey: ["payments", "manual", orderId],
      });
      navigate(`/orders/${encodeURIComponent(orderId!)}`, {
        replace: true,
      });
    },
  });

  if (!orderId) {
    return <Navigate replace to="/products" />;
  }
  if (authStatus !== "authenticated" || !user) {
    return (
      <Navigate
        replace
        state={{
          returnTo: `/orders/${encodeURIComponent(orderId)}/payment`,
        }}
        to="/login"
      />
    );
  }
  if (!isBuyerRole(user.role)) {
    return <Navigate replace to="/products" />;
  }
  if (paymentQuery.isPending && !paymentDestination) {
    return (
      <FullPageStatus
        description="Loading payment details."
        icon={LoaderCircle}
        title="Preparing payment"
      />
    );
  }
  if (paymentQuery.isError && !paymentDestination) {
    return (
      <FullPageStatus
        action={{ label: "Try again", onClick: () => void paymentQuery.refetch() }}
        description={getApiErrorMessage(
          paymentQuery.error,
          "Payment details could not be loaded.",
        )}
        icon={AlertTriangle}
        title="Payment unavailable"
      />
    );
  }

  const details = paymentQuery.data;
  const payment = details?.payment;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
          <Landmark aria-hidden="true" className="size-6" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-700">
            {paymentDestination?.providerName ?? "Manual payment"}
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">
            Complete your payment
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Order{" "}
            <span className="break-all font-semibold text-zinc-800">
              {orderId}
            </span>
          </p>
        </div>
      </div>

      {payment ? (
        <section
          aria-labelledby="payment-submitted-heading"
          className="mt-8 border-y border-zinc-200 py-8"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2
              aria-hidden="true"
              className="mt-0.5 size-6 shrink-0 text-emerald-700"
            />
            <div>
              <h2
                className="text-xl font-semibold text-zinc-950"
                id="payment-submitted-heading"
              >
                Payment proof submitted
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                Your order is pending payment verification.
              </p>
            </div>
          </div>

          <dl className="mt-6 divide-y divide-zinc-200 border-y border-zinc-200">
            <DetailRow label="Provider" value={payment.providerName} />
            <DetailRow
              label="Payment status"
              value={formatPaymentStatus(payment.status)}
            />
            <DetailRow
              label="Submitted"
              value={new Date(payment.createdAt).toLocaleString()}
            />
          </dl>

          <Link
            className="mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            to="/products"
          >
            <PackageCheck aria-hidden="true" className="size-4" />
            Continue shopping
          </Link>
        </section>
      ) : (
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-8">
            {paymentDestination ? (
              <section
                aria-labelledby="payment-destination-heading"
                className="border-b border-zinc-200 pb-8"
              >
                <div className="flex items-center justify-between gap-4">
                  <h2
                    className="text-base font-semibold text-zinc-950"
                    id="payment-destination-heading"
                  >
                    Payment destination
                  </h2>
                  <button
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
                    onClick={() => {
                      void copyText(paymentDestination.accountNumber).then(
                        () => {
                          setCopiedAccountNumber(true);
                          window.setTimeout(
                            () => setCopiedAccountNumber(false),
                            2000,
                          );
                        },
                      );
                    }}
                    type="button"
                  >
                    {copiedAccountNumber ? (
                      <Check aria-hidden="true" className="size-4" />
                    ) : (
                      <Copy aria-hidden="true" className="size-4" />
                    )}
                    {copiedAccountNumber ? "Copied" : "Copy number"}
                  </button>
                </div>

                <dl className="mt-5 divide-y divide-zinc-200 border-y border-zinc-200">
                  <DetailRow
                    label="Provider"
                    value={paymentDestination.providerName}
                  />
                  <DetailRow
                    label="Account name"
                    value={paymentDestination.accountName}
                  />
                  <DetailRow
                    label={paymentDestination.accountNumberLabel}
                    value={paymentDestination.accountNumber}
                  />
                  <DetailRow
                    label="Payment reference"
                    value={
                      storedInstructions?.paymentReference ?? orderId
                    }
                  />
                </dl>
              </section>
            ) : null}

            <PaymentProofUpload
              disabled={paymentMutation.isPending}
              file={proofFile}
              onChange={setProofFile}
            />
          </div>

          <aside className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <div className="flex items-start gap-3">
              <Clock3
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-amber-700"
              />
              <div>
                <h2 className="text-base font-semibold text-zinc-950">
                  Awaiting transfer
                </h2>
                <p className="mt-1 text-sm leading-6 text-zinc-600">
                  {storedInstructions?.receiptUploadInstructions ??
                    "Upload a clear screenshot of your transfer receipt for verification."}
                </p>
              </div>
            </div>

            {details?.order.totalAmount ? (
              <div className="mt-5 border-t border-zinc-200 pt-5">
                <p className="text-xs font-medium uppercase text-zinc-500">
                  Order total
                </p>
                <p className="mt-1 text-xl font-semibold text-zinc-950">
                  {formatProductPrice(details.order.totalAmount)}
                </p>
              </div>
            ) : null}

            {paymentMutation.isError ? (
              <div
                className="mt-5 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm leading-5 text-red-800"
                role="alert"
              >
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
                <p>
                  {getApiErrorMessage(
                    paymentMutation.error,
                    "Payment proof could not be submitted.",
                  )}
                </p>
              </div>
            ) : null}

            <button
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={
                paymentMutation.isPending ||
                !paymentDestination ||
                !proofFile
              }
              onClick={() => paymentMutation.mutate()}
              type="button"
            >
              {paymentMutation.isPending ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
              ) : (
                <CheckCircle2 aria-hidden="true" className="size-4" />
              )}
              {paymentMutation.isPending
                ? "Submitting proof..."
                : "Submit payment proof"}
            </button>
          </aside>
        </div>
      )}
    </main>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-zinc-600">{label}</dt>
      <dd className="break-all text-sm font-semibold text-zinc-950">
        {value}
      </dd>
    </div>
  );
}

function formatPaymentStatus(
  status: "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED",
): string {
  switch (status) {
    case "PENDING_VERIFICATION":
      return "Pending verification";
    case "VERIFIED":
      return "Verified";
    case "REJECTED":
      return "Rejected";
  }
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall back for browsers that block clipboard access.
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
