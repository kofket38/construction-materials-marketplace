import type { PaymentDestination } from "@/features/checkout/api/orders.api";
import type { ManualPaymentMethod } from "@/features/checkout/model/checkout.schema";
import { apiClient } from "@/shared/api/http-client";
import type { ApiSuccessResponse } from "@/shared/api/api.types";

export interface ManualPayment {
  id: string;
  orderId: string;
  method: ManualPaymentMethod;
  providerName: string;
  proofImageUrl: string;
  status: "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED";
  createdAt: string;
  verifiedAt: string | null;
}

export interface ManualPaymentDetails {
  order: {
    id: string;
    status:
      | "PENDING_PAYMENT"
      | "PENDING_PAYMENT_VERIFICATION"
      | "PENDING_CONFIRMATION"
      | "PROCESSING"
      | "PENDING"
      | "CONFIRMED"
      | "SHIPPED"
      | "DELIVERED"
      | "COMPLETED"
      | "CANCELLED";
    paymentMethod: ManualPaymentMethod;
    totalAmount: string;
  };
  payment: ManualPayment | null;
  paymentDestination: PaymentDestination;
}

export interface CheckoutPaymentOptions {
  seller: {
    id: string;
    name: string;
    phone: string;
  };
  paymentDestinations: PaymentDestination[];
}

interface SubmittedPaymentData {
  payment: ManualPayment;
}

export async function getCheckoutPaymentOptions(
  productIds: string[],
  signal?: AbortSignal,
): Promise<CheckoutPaymentOptions> {
  const response = await apiClient.post<
    ApiSuccessResponse<CheckoutPaymentOptions>
  >(
    "/payments/options",
    { productIds },
    { signal },
  );

  return response.data.data;
}

export async function getManualPayment(
  orderId: string,
  signal?: AbortSignal,
): Promise<ManualPaymentDetails> {
  const response = await apiClient.get<
    ApiSuccessResponse<ManualPaymentDetails>
  >(`/payments/${encodeURIComponent(orderId)}`, { signal });

  return response.data.data;
}

export async function submitManualPayment(
  orderId: string,
  proof: File,
): Promise<ManualPayment> {
  const formData = new FormData();
  formData.set("orderId", orderId);
  formData.set("proof", proof);

  const response = await apiClient.post<
    ApiSuccessResponse<SubmittedPaymentData>
  >("/payments/manual", formData);

  return response.data.data.payment;
}
