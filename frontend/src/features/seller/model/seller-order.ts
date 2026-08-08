import type {
  OrderPaymentMethod,
  OrderStatus,
  PaymentProofStatus,
} from "@/features/orders/model/order";

export interface SellerOrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: string;
  lineTotal: string;
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
    category: {
      id: string;
      name: string;
    };
  };
}

export interface SellerOrder {
  id: string;
  customerId: string;
  customer: {
    id: string;
    name: string;
    email: string;
  };
  status: OrderStatus;
  paymentMethod: OrderPaymentMethod;
  shippingFullName: string;
  shippingPhone: string;
  shippingCity: string;
  shippingAddress: string;
  shippingNotes: string | null;
  payment: {
    id: string;
    method: OrderPaymentMethod;
    providerName: string;
    proofImageUrl: string;
    status: PaymentProofStatus;
    createdAt: string;
    verifiedAt: string | null;
  } | null;
  sellerTotal: string;
  totalItems: number;
  items: SellerOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SellerDashboardSummary {
  pendingPaymentVerification: number;
  paymentVerified: number;
  processing: number;
  readyForDelivery: number;
  outForDelivery: number;
  delivered: number;
  totalOrders: number;
  totalRevenue: string;
  recentOrders: SellerOrder[];
}

export interface SellerOrdersResult {
  orders: SellerOrder[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type SellerOrderStatusUpdate =
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export type SellerPaymentDecision = "APPROVE" | "REJECT";
