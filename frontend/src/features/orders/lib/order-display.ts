import type {
  CustomerOrder,
  OrderPaymentMethod,
  OrderStatus,
  PaymentProofStatus,
} from "@/features/orders/model/order";

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "short",
  year: "numeric",
});

const paymentMethodLabels: Record<OrderPaymentMethod, string> = {
  CASH_ON_DELIVERY: "Cash on delivery",
  TELEBIRR: "Telebirr",
  CBE_BIRR: "CBE Birr",
  AWASH_BIRR: "Awash Birr",
  BANK_TRANSFER: "Bank transfer",
  CBE_BANK: "CBE Bank",
  AWASH_BANK: "Awash Bank",
  DASHEN_BANK: "Dashen Bank",
  E_BIRR: "E-Birr",
};

const orderStatusLabels: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PENDING_PAYMENT_VERIFICATION: "Awaiting seller",
  PAYMENT_VERIFIED: "Awaiting seller",
  PAYMENT_REJECTED: "Payment rejected",
  PENDING_CONFIRMATION: "Awaiting seller",
  PROCESSING: "Preparing",
  READY_FOR_DELIVERY: "Ready for pickup",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  PENDING: "Awaiting seller",
  CONFIRMED: "Confirmed",
  SHIPPED: "Out for delivery",
};

const paymentProofStatusLabels: Record<PaymentProofStatus, string> = {
  PENDING_VERIFICATION: "Pending verification",
  VERIFIED: "Approved",
  REJECTED: "Rejected",
};

export function formatOrderDate(value: string): string {
  return formatDate(value, dateFormatter);
}

export function formatOrderDateTime(value: string): string {
  return formatDate(value, dateTimeFormatter);
}

export function formatOrderNumber(orderId: string): string {
  return `#${orderId.slice(0, 8).toUpperCase()}`;
}

export function formatOrderStatus(status: OrderStatus): string {
  return orderStatusLabels[status];
}

export function formatPaymentMethod(
  method: OrderPaymentMethod | undefined,
): string {
  return method ? paymentMethodLabels[method] : "Not provided";
}

export function formatPaymentProofStatus(
  status: PaymentProofStatus,
): string {
  return paymentProofStatusLabels[status];
}

export function getOrderSellerIds(order: CustomerOrder): string[] {
  return [
    ...new Set(order.items.map((item) => item.product.sellerId)),
  ];
}

export function isManualPaymentOrder(order: CustomerOrder): boolean {
  return (
    order.paymentMethod !== undefined &&
    order.paymentMethod !== "CASH_ON_DELIVERY"
  );
}

function formatDate(
  value: string,
  formatter: Intl.DateTimeFormat,
): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : formatter.format(date);
}
