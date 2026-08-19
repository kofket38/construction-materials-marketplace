import type { CartItem } from "@/features/cart/model/cart";
import type {
  CheckoutPaymentMethod,
  CheckoutShippingValues,
  ManualPaymentMethod,
} from "@/features/checkout/model/checkout.schema";
import { apiClient } from "@/shared/api/http-client";
import type { ApiSuccessResponse } from "@/shared/api/api.types";

export type OrderPaymentMethod = CheckoutPaymentMethod;

interface CreatedOrderBase {
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
  totalAmount: string;
}

export interface CashOnDeliveryOrder extends CreatedOrderBase {
  paymentMethod: "CASH_ON_DELIVERY";
}

export interface ManualPaymentOrder extends CreatedOrderBase {
  paymentMethod: ManualPaymentMethod;
}

export interface ManualPaymentInstructions {
  paymentDestination: PaymentDestination;
  paymentReference: string;
  amount: string;
  receiptUploadInstructions: string;
}

export interface PaymentDestination {
  method: ManualPaymentMethod;
  providerName: string;
  accountName: string;
  accountNumber: string;
  accountNumberLabel: "Payment number" | "Account number";
}

export type CreateOrderResult =
  | {
      order: CashOnDeliveryOrder;
    }
  | {
      order: ManualPaymentOrder;
      manualPaymentInstructions: ManualPaymentInstructions;
    };

export async function createOrder(
  items: CartItem[],
  shipping: CheckoutShippingValues,
  paymentMethod: OrderPaymentMethod,
): Promise<CreateOrderResult> {
  const response = await apiClient.post<
    ApiSuccessResponse<CreateOrderResult>
  >("/orders", {
    items: items.map((item) => ({
      productId: item.productId,
      sellerId: item.sellerId,
      quantity: item.quantity,
    })),
    shipping,
    paymentMethod,
  });

  return response.data.data;
}
