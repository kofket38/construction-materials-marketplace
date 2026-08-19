import type { ApiSuccessResponse } from "@/shared/api/api.types";
import { apiClient } from "@/shared/api/http-client";

// ── Shared pagination ────────────────────────────────────────────────────────

export interface AdminPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export type AdminActivityType =
  | "USER_REGISTERED"
  | "PRODUCT_CREATED"
  | "ORDER_CREATED";

export interface AdminRecentActivity {
  type: AdminActivityType;
  entityId: string;
  label: string;
  createdAt: string;
}

export interface AdminDashboardSummary {
  totalUsers: number;
  totalCustomers: number;
  totalSellers: number;
  totalProducts: number;
  totalCategories: number;
  totalOrders: number;
  totalRevenue: string;
  monthlyRevenue: string;
  recentActivity: AdminRecentActivity[];
}

export async function getAdminDashboard(
  signal?: AbortSignal,
): Promise<AdminDashboardSummary> {
  const res = await apiClient.get<
    ApiSuccessResponse<{ dashboard: AdminDashboardSummary }>
  >("/admin/dashboard", { signal });
  return res.data.data.dashboard;
}

// ── Users ────────────────────────────────────────────────────────────────────

export type AdminUserRole = "CUSTOMER" | "SELLER" | "ADMIN";
export type AdminUserStatus = "ACTIVE" | "DISABLED";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  role: AdminUserRole;
  status: AdminUserStatus;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUsersResult {
  users: AdminUser[];
  pagination: AdminPagination;
}

export interface AdminUsersQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: AdminUserRole | "";
}

export async function getAdminUsers(
  query: AdminUsersQuery,
  signal?: AbortSignal,
): Promise<AdminUsersResult> {
  const params: Record<string, string | number> = {
    page: query.page ?? 1,
    limit: query.limit ?? 20,
  };
  if (query.search) params.search = query.search;
  if (query.role) params.role = query.role;

  const res = await apiClient.get<ApiSuccessResponse<AdminUsersResult>>(
    "/admin/users",
    { params, signal },
  );
  return res.data.data;
}

export async function updateAdminUserStatus(
  id: string,
  status: "ACTIVE" | "DISABLED",
): Promise<AdminUser> {
  const res = await apiClient.patch<
    ApiSuccessResponse<{ user: AdminUser }>
  >(`/admin/users/${encodeURIComponent(id)}/status`, { status });
  return res.data.data.user;
}

// ── Sellers ──────────────────────────────────────────────────────────────────

export interface AdminSeller {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  shopName: string | null;
  shopPhone: string | null;
  address: string | null;
  status: AdminUserStatus;
  productCount: number;
  orderCount: number;
  revenue: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSellersResult {
  sellers: AdminSeller[];
  pagination: AdminPagination;
}

export async function getAdminSellers(
  query: { page?: number; limit?: number; search?: string },
  signal?: AbortSignal,
): Promise<AdminSellersResult> {
  const params: Record<string, string | number> = {
    page: query.page ?? 1,
    limit: query.limit ?? 20,
  };
  if (query.search) params.search = query.search;

  const res = await apiClient.get<ApiSuccessResponse<AdminSellersResult>>(
    "/admin/sellers",
    { params, signal },
  );
  return res.data.data;
}

// ── Products ─────────────────────────────────────────────────────────────────

export interface AdminProductSeller {
  id: string;
  name: string;
  email: string;
  shopName: string | null;
}

export interface AdminProductCategory {
  id: string;
  name: string;
}

export interface AdminProduct {
  id: string;
  sellerId: string;
  categoryId: string;
  name: string;
  description: string;
  price: string;
  quantity: number;
  imageUrl: string | null;
  seller: AdminProductSeller;
  category: AdminProductCategory;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProductsResult {
  products: AdminProduct[];
  pagination: AdminPagination;
}

export interface AdminProductsQuery {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  sellerId?: string;
}

export async function getAdminProducts(
  query: AdminProductsQuery,
  signal?: AbortSignal,
): Promise<AdminProductsResult> {
  const params: Record<string, string | number> = {
    page: query.page ?? 1,
    limit: query.limit ?? 20,
  };
  if (query.search) params.search = query.search;
  if (query.categoryId) params.categoryId = query.categoryId;
  if (query.sellerId) params.sellerId = query.sellerId;

  const res = await apiClient.get<ApiSuccessResponse<AdminProductsResult>>(
    "/admin/products",
    { params, signal },
  );
  return res.data.data;
}

export async function deleteAdminProduct(id: string): Promise<void> {
  await apiClient.delete(`/admin/products/${encodeURIComponent(id)}`, {
    data: {},
  });
}

// ── Orders ────────────────────────────────────────────────────────────────────

export type AdminOrderStatus =
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

export type AdminPaymentStatus = "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED";

export interface AdminOrderCustomer {
  id: string;
  name: string;
  email: string;
}

export interface AdminOrderItem {
  id: string;
  productId: string;
  productName: string;
  productImageUrl: string | null;
  sellerId: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
}

export interface AdminOrderPayment {
  method: string;
  status: AdminPaymentStatus;
  proofImageUrl: string | null;
  verifiedAt: string | null;
}

export interface AdminOrder {
  id: string;
  customerId: string;
  customer: AdminOrderCustomer;
  status: AdminOrderStatus;
  paymentMethod: string;
  totalAmount: string;
  shippingFullName: string;
  shippingPhone: string;
  shippingCity: string;
  shippingAddress: string;
  shippingNotes: string | null;
  itemCount: number;
  items: AdminOrderItem[];
  payment: AdminOrderPayment | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrdersResult {
  orders: AdminOrder[];
  pagination: AdminPagination;
}

export interface AdminOrdersQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: AdminOrderStatus | "";
  paymentStatus?: AdminPaymentStatus | "";
}

export async function getAdminOrders(
  query: AdminOrdersQuery,
  signal?: AbortSignal,
): Promise<AdminOrdersResult> {
  const params: Record<string, string | number> = {
    page: query.page ?? 1,
    limit: query.limit ?? 20,
  };
  if (query.search) params.search = query.search;
  if (query.status) params.status = query.status;
  if (query.paymentStatus) params.paymentStatus = query.paymentStatus;

  const res = await apiClient.get<ApiSuccessResponse<AdminOrdersResult>>(
    "/admin/orders",
    { params, signal },
  );
  return res.data.data;
}

export async function updateAdminOrderStatus(
  id: string,
  status: AdminOrderStatus,
): Promise<void> {
  // Reuses the existing PATCH /api/orders/:id/status endpoint which already
  // accepts ADMIN tokens and enforces the existing state machine.
  await apiClient.patch(
    `/orders/${encodeURIComponent(id)}/status`,
    { status },
  );
}
