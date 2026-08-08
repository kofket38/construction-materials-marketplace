import {
  AlertTriangle,
  ArrowLeft,
  LoaderCircle,
  ShoppingCart,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { useAuthStore } from "@/features/auth/model/auth.store";
import {
  calculateCartSubtotal,
  formatCartAmount,
} from "@/features/cart/lib/cart-pricing";
import {
  emptyCartItems,
  useCartStore,
} from "@/features/cart/model/cart.store";
import { createOrder } from "@/features/checkout/api/orders.api";
import {
  getCheckoutPaymentOptions,
  submitManualPayment,
} from "@/features/checkout/api/payments.api";
import { CheckoutForm } from "@/features/checkout/components/CheckoutForm";
import { OrderReview } from "@/features/checkout/components/OrderReview";
import { PaymentProviders } from "@/features/checkout/components/PaymentProviders";
import { saveManualPaymentInstructions } from "@/features/checkout/lib/bank-transfer-storage";
import {
  checkoutSchema,
  type CheckoutFormValues,
} from "@/features/checkout/model/checkout.schema";
import { getApiErrorMessage } from "@/shared/api/http-error";
import {
  defaultFormOptions,
  zodResolver,
} from "@/shared/forms/form-config";

export function CheckoutPage() {
  const navigate = useNavigate();
  const [proofFile, setProofFile] = useState<File | null>(null);
  const authStatus = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const hydrationStatus = useCartStore((state) => state.hydrationStatus);
  const clearCart = useCartStore((state) => state.clearCart);
  const items = useCartStore((state) =>
    user?.role === "CUSTOMER"
      ? (state.cartsByUserId[user.id] ?? emptyCartItems)
      : emptyCartItems,
  );
  const form = useForm<CheckoutFormValues>({
    ...defaultFormOptions,
    defaultValues: {
      address: "",
      city: "",
      fullName: user?.name ?? "",
      notes: "",
      phone: user?.phone ?? "",
    },
    resolver: zodResolver(checkoutSchema),
  });
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    setError,
  } = form;
  const selectedPaymentMethod = useWatch({
    control: form.control,
    name: "paymentMethod",
  });
  const paymentOptionsQuery = useQuery({
    queryKey: [
      "checkout",
      "payment-options",
      items.map((item) => item.productId),
    ],
    enabled:
      authStatus === "authenticated" &&
      user?.role === "CUSTOMER" &&
      items.length > 0,
    queryFn: ({ signal }) =>
      getCheckoutPaymentOptions(
        items.map((item) => item.productId),
        signal,
      ),
    retry: false,
  });

  if (authStatus !== "authenticated" || !user) {
    return <Navigate replace state={{ returnTo: "/checkout" }} to="/login" />;
  }

  if (user.role !== "CUSTOMER") {
    return <Navigate replace to="/cart" />;
  }

  if (hydrationStatus === "idle" || hydrationStatus === "loading") {
    return (
      <main
        aria-live="polite"
        className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16"
      >
        <div className="text-center">
          <LoaderCircle
            aria-hidden="true"
            className="mx-auto size-8 animate-spin text-emerald-700"
          />
          <p className="mt-4 text-sm font-medium text-zinc-600">
            Preparing checkout...
          </p>
        </div>
      </main>
    );
  }

  if (hydrationStatus === "error" || items.length === 0) {
    return <Navigate replace to="/cart" />;
  }

  const subtotal = calculateCartSubtotal(items);
  const submitOrder = handleSubmit(async (values) => {
    const { paymentMethod, ...shipping } = values;
    const isManualPayment = paymentMethod !== "CASH_ON_DELIVERY";

    if (isManualPayment && !proofFile) {
      setError("root", {
        message: "Upload your payment screenshot before submitting.",
      });
      return;
    }

    try {
      const result = await createOrder(items, shipping, paymentMethod);

      if ("manualPaymentInstructions" in result) {
        saveManualPaymentInstructions(
          result.order.id,
          result.manualPaymentInstructions,
        );
        try {
          await submitManualPayment(result.order.id, proofFile!);
        } catch (error) {
          void clearCart(user.id);
          navigate(
            `/orders/${encodeURIComponent(result.order.id)}/payment`,
            {
              replace: true,
              state: {
                submissionError: getApiErrorMessage(
                  error,
                  "The order was created, but the payment proof could not be uploaded. Please try again.",
                ),
              },
            },
          );
          return;
        }

        void clearCart(user.id);
        navigate(
          `/orders/${encodeURIComponent(result.order.id)}`,
          { replace: true },
        );
      } else {
        void clearCart(user.id);
        navigate(
          `/orders/${encodeURIComponent(result.order.id)}`,
          { replace: true },
        );
      }
    } catch (error) {
      setError("root", {
        message: getApiErrorMessage(
          error,
          "Your order could not be placed. Please review your cart and try again.",
        ),
      });
    }
  });

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <Link
        className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-zinc-600 transition-colors hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
        to="/cart"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Back to cart
      </Link>

      <div className="mt-4">
        <p className="text-sm font-semibold text-emerald-700">Checkout</p>
        <h1 className="mt-1 text-3xl font-semibold text-zinc-950">
          Complete your order
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
          Confirm delivery details and review your materials before payment.
        </p>
      </div>

      <FormProvider {...form}>
        <form
          className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]"
          noValidate
          onSubmit={submitOrder}
        >
          <div className="min-w-0">
            <CheckoutForm />
            <OrderReview items={items} />
            <PaymentProviders
              amount={subtotal.toFixed(2)}
              disabled={paymentOptionsQuery.isPending}
              isLoading={paymentOptionsQuery.isPending}
              isSubmitting={isSubmitting}
              onProofChange={setProofFile}
              paymentDestinations={
                paymentOptionsQuery.data?.paymentDestinations ?? []
              }
              proofFile={proofFile}
              seller={paymentOptionsQuery.data?.seller ?? null}
              unavailableMessage={
                paymentOptionsQuery.isError
                  ? getApiErrorMessage(
                      paymentOptionsQuery.error,
                      "Digital payment is unavailable for this cart. Cash on delivery is still available.",
                    )
                  : paymentOptionsQuery.data &&
                      paymentOptionsQuery.data.paymentDestinations.length === 0
                    ? "This seller has not configured digital payment providers. Cash on delivery is still available."
                    : undefined
              }
            />
          </div>

          <aside className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                <ShoppingCart aria-hidden="true" className="size-4" />
              </span>
              <h2 className="text-lg font-semibold text-zinc-950">
                Order summary
              </h2>
            </div>

            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-zinc-600">Cart subtotal</dt>
                <dd className="font-semibold text-zinc-950">
                  {formatCartAmount(subtotal)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-zinc-600">Delivery fee</dt>
                <dd className="max-w-32 text-right font-medium text-zinc-600">
                  To be calculated
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 border-t border-zinc-200 pt-4">
                <dt className="font-semibold text-zinc-950">Grand total</dt>
                <dd className="text-lg font-semibold text-zinc-950">
                  {formatCartAmount(subtotal)}
                </dd>
              </div>
            </dl>

            {errors.root?.message ? (
              <div
                className="mt-5 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm leading-5 text-red-800"
                role="alert"
              >
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
                <p>{errors.root.message}</p>
              </div>
            ) : null}

            {selectedPaymentMethod === "CASH_ON_DELIVERY" ? (
              <button
                className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                ) : (
                  <ShoppingCart aria-hidden="true" className="size-4" />
                )}
                {isSubmitting ? "Placing order..." : "Place order"}
              </button>
            ) : selectedPaymentMethod ? (
              <p className="mt-6 border-t border-zinc-200 pt-5 text-sm leading-6 text-zinc-600">
                Complete the seller payment details and upload your receipt
                in the payment panel.
              </p>
            ) : (
              <p className="mt-6 border-t border-zinc-200 pt-5 text-sm leading-6 text-zinc-600">
                Select a payment provider to continue.
              </p>
            )}
          </aside>
        </form>
      </FormProvider>
    </main>
  );
}
