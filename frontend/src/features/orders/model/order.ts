import type { LinkedProjectSummary } from "@/features/projects/api/projects.api";

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PENDING_PAYMENT_VERIFICATION"
  | "PAYMENT_VERIFIED"
  | "PAYMENT_REJECTED"
  | "PENDING_CONFIRMATION"
  | "PROCESSING"
  | "READY_FOR_DELIVERY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED"
  | "PENDING"
  | "CONFIRMED"
  | "SHIPPED";

export type OrderPaymentMethod =
  | "CASH_ON_DELIVERY"
  | "TELEBIRR"
  | "CBE_BIRR"
  | "AWASH_BIRR"
  | "BANK_TRANSFER"
  | "CBE_BANK"
  | "AWASH_BANK"
  | "DASHEN_BANK"
  | "E_BIRR";

export interface CustomerOrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice?: string;
  subtotal?: string;
  price: string;
  product: {
    id: string;
    sellerId: string;
    name: string;
    imageUrl: string | null;
  };
}

export interface CustomerOrder {
  id: string;
  customerId: string;
  /**
   * The professional project this order was placed for, present on the detail
   * read only and filled in for its owner alone. Absent on list results, and
   * null whenever the order is standalone or the reader does not own it.
   */
  project?: LinkedProjectSummary | null;
  status: OrderStatus;
  paymentMethod?: OrderPaymentMethod;
  totalAmount: string;
  shippingFullName?: string;
  shippingPhone?: string;
  shippingCity?: string;
  shippingAddress?: string;
  shippingNotes?: string | null;
  items: CustomerOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export type PaymentProofStatus =
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "REJECTED";
