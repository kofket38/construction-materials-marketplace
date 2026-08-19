export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PENDING_PAYMENT_VERIFICATION"
  | "PAYMENT_VERIFIED"
  | "PAYMENT_REJECTED"
  | "PENDING_CONFIRMATION"
  | "PROCESSING"
  | "READY_FOR_DELIVERY"
  | "OUT_FOR_DELIVERY"
  | "REJECTED"
  | "PENDING"
  | "CONFIRMED"
  | "SHIPPED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED";

export type PaymentMethod =
  | "CASH_ON_DELIVERY"
  | "TELEBIRR"
  | "CBE_BIRR"
  | "AWASH_BIRR"
  | "BANK_TRANSFER"
  | "CBE_BANK"
  | "AWASH_BANK"
  | "DASHEN_BANK"
  | "E_BIRR";

export interface OrderCustomerSummary {
  id: string;
  name: string;
  email: string;
}

export interface OrderProductSummary {
  id: string;
  sellerId: string;
  name: string;
  imageUrl: string | null;
}

export interface OrderItemEntity {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice?: string;
  subtotal?: string;
  /** Legacy alias retained for seller, admin, and RFQ compatibility. */
  price: string;
  product: OrderProductSummary;
}

export interface OrderEntity {
  id: string;
  customerId: string;
  status: OrderStatus;
  paymentMethod?: PaymentMethod;
  totalAmount: string;
  shippingFullName?: string;
  shippingPhone?: string;
  shippingCity?: string;
  shippingAddress?: string;
  shippingNotes?: string | null;
  customer: OrderCustomerSummary;
  items: OrderItemEntity[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderItemInput {
  productId: string;
  sellerId: string;
  quantity: number;
}

export interface CreateOrderInput {
  customerId: string;
  items: CreateOrderItemInput[];
  paymentMethod: PaymentMethod;
  shipping: {
    fullName: string;
    phone: string;
    city: string;
    address: string;
    notes?: string;
  };
  status: Extract<
    OrderStatus,
    "PENDING_PAYMENT" | "PENDING_CONFIRMATION"
  >;
}

export interface CancelOrderOptions {
  onlyIfPending: boolean;
}

export interface OrderRepository {
  create(input: CreateOrderInput): Promise<OrderEntity>;
  findById(id: string): Promise<OrderEntity | null>;
  findByCustomerId(customerId: string): Promise<OrderEntity[]>;
  updateStatus(
    id: string,
    status: OrderStatus,
  ): Promise<OrderEntity | null>;
  complete(
    id: string,
    customerId: string,
  ): Promise<OrderEntity | null>;
  cancel(
    id: string,
    options: CancelOrderOptions,
  ): Promise<OrderEntity | null>;
}
