import type {
  ManualPaymentMethod,
  PaymentDestination,
} from "../types/payment.js";

export interface SellerPaymentProfile {
  sellerId: string;
  sellerName: string;
  sellerPhone: string;
  destinations: PaymentDestination[];
}

export interface CheckoutSellerResolution {
  missingProductIds: string[];
  sellerIds: string[];
}

export interface SellerPaymentRepository {
  findBySellerId(sellerId: string): Promise<SellerPaymentProfile | null>;
  resolveCheckoutSellers(
    productIds: string[],
  ): Promise<CheckoutSellerResolution>;
}

export const checkoutManualPaymentMethods = [
  "TELEBIRR",
  "CBE_BIRR",
  "CBE_BANK",
  "AWASH_BANK",
  "DASHEN_BANK",
  "E_BIRR",
] as const satisfies readonly ManualPaymentMethod[];
