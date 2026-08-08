import type {
  OrderStatus,
  PaymentMethod,
} from "./order.repository.js";
import type { PaymentStatus } from "./payment.repository.js";
import type { ProductEntity } from "./product.repository.js";

export type SellerProductSortBy =
  | "createdAt"
  | "name"
  | "price"
  | "quantity";

export type SortOrder = "asc" | "desc";

export type SellerProductStockFilter =
  | "in_stock"
  | "low_stock"
  | "out_of_stock";

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SellerProductQuery {
  page: number;
  limit: number;
  search?: string;
  sortBy: SellerProductSortBy;
  sortOrder: SortOrder;
  categoryId?: string;
  stock?: SellerProductStockFilter;
}

export interface SellerProductsResult {
  products: ProductEntity[];
  pagination: Pagination;
  inventorySummary: {
    totalProducts: number;
    lowStock: number;
    outOfStock: number;
    inventoryValue: string;
  };
}

export interface SellerOrderQuery {
  page: number;
  limit: number;
  status?: OrderStatus;
  dateFrom?: Date;
  dateToExclusive?: Date;
  customerSearch?: string;
}

export interface SellerOrderCustomer {
  id: string;
  name: string;
  email: string;
}

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

export interface SellerOrderEntity {
  id: string;
  customerId: string;
  customer: SellerOrderCustomer;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  shippingFullName: string;
  shippingPhone: string;
  shippingCity: string;
  shippingAddress: string;
  shippingNotes: string | null;
  payment: {
    id: string;
    method: PaymentMethod;
    providerName: string;
    proofImageUrl: string;
    status: PaymentStatus;
    createdAt: Date;
    verifiedAt: Date | null;
  } | null;
  sellerTotal: string;
  totalItems: number;
  items: SellerOrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SellerOrdersResult {
  orders: SellerOrderEntity[];
  pagination: Pagination;
}

export interface SellerDashboardPeriod {
  monthStart: Date;
  nextMonthStart: Date;
}

export interface SellerDashboardSummary {
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalRevenue: string;
  monthlyRevenue: string;
  pendingPaymentVerification: number;
  paymentVerified: number;
  processing: number;
  readyForDelivery: number;
  outForDelivery: number;
  delivered: number;
  recentOrders: SellerOrderEntity[];
}

export type SellerPaymentDecision = "APPROVE" | "REJECT";

export interface SellerAnalyticsPeriod {
  startDate: Date;
  endDate: Date;
}

export interface BestSellingProduct {
  productId: string;
  name: string;
  unitsSold: number;
  revenue: string;
}

export interface MonthlySales {
  month: string;
  orders: number;
  unitsSold: number;
}

export interface MonthlyRevenue {
  month: string;
  revenue: string;
}

export interface OrdersByStatus {
  status: OrderStatus;
  count: number;
}

export interface TopCategory {
  categoryId: string;
  name: string;
  unitsSold: number;
  revenue: string;
}

export interface SellerAnalytics {
  period: {
    startDate: Date;
    endDate: Date;
  };
  bestSellingProducts: BestSellingProduct[];
  monthlySales: MonthlySales[];
  revenueByMonth: MonthlyRevenue[];
  ordersByStatus: OrdersByStatus[];
  topCategories: TopCategory[];
}

export interface SellerDashboardRepository {
  getDashboard(
    sellerId: string,
    period: SellerDashboardPeriod,
  ): Promise<SellerDashboardSummary>;
  findProducts(
    sellerId: string,
    query: SellerProductQuery,
  ): Promise<SellerProductsResult>;
  findOrders(
    sellerId: string,
    query: SellerOrderQuery,
  ): Promise<SellerOrdersResult>;
  findOrderById(
    sellerId: string,
    orderId: string,
  ): Promise<SellerOrderEntity | null>;
  verifyPayment(
    sellerId: string,
    orderId: string,
    decision: SellerPaymentDecision,
  ): Promise<SellerOrderEntity | null>;
  updateOrderStatus(
    sellerId: string,
    orderId: string,
    expectedStatus: OrderStatus,
    status: OrderStatus,
  ): Promise<SellerOrderEntity | null>;
  getAnalytics(
    sellerId: string,
    period: SellerAnalyticsPeriod,
  ): Promise<SellerAnalytics>;
}
