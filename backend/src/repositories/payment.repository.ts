import type { ManualPaymentMethod } from "../types/payment.js";

export type PaymentStatus =
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "REJECTED";

export interface PaymentEntity {
  id: string;
  orderId: string;
  method: ManualPaymentMethod;
  providerName: string;
  proofImageUrl: string;
  status: PaymentStatus;
  createdAt: Date;
  verifiedAt: Date | null;
}

export interface CreateManualPaymentInput {
  orderId: string;
  customerId: string;
  method: ManualPaymentMethod;
  providerName: string;
  proofImageUrl: string;
}

/** Minimal projection used by the proof-serve endpoint for authorization */
export interface PaymentProofAuthorization {
  /** The opaque filename stored in DB (equals proofImageUrl) */
  proofFilename: string;
  customerId: string;
  /** All seller IDs that have items in this order */
  sellerIds: string[];
}

export interface PaymentRepository {
  createManual(
    input: CreateManualPaymentInput,
  ): Promise<PaymentEntity>;
  findByOrderId(orderId: string): Promise<PaymentEntity | null>;
  findByProofFilename(filename: string): Promise<PaymentProofAuthorization | null>;
}
