import type { UserRole } from "./user.repository.js";

export type AdminUserStatus = "ACTIVE" | "DISABLED";

export type AdminActivityType =
  | "USER_REGISTERED"
  | "PRODUCT_CREATED"
  | "ORDER_CREATED";

export interface AdminRecentActivity {
  type: AdminActivityType;
  entityId: string;
  label: string;
  createdAt: Date;
}

export interface AdminDashboardPeriod {
  monthStart: Date;
  nextMonthStart: Date;
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

export interface AdminUserEntity {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  role: UserRole;
  status: AdminUserStatus;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminUserQuery {
  page: number;
  limit: number;
  search?: string;
  role?: UserRole;
}

export interface AdminUsersResult {
  users: AdminUserEntity[];
  pagination: AdminPagination;
}

export interface AdminSellerEntity {
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
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminSellerQuery {
  page: number;
  limit: number;
  search?: string;
}

export interface AdminSellersResult {
  sellers: AdminSellerEntity[];
  pagination: AdminPagination;
}

export interface AdminProductSellerSummary {
  id: string;
  name: string;
  email: string;
  shopName: string | null;
}

export interface AdminProductCategorySummary {
  id: string;
  name: string;
}

export interface AdminProductEntity {
  id: string;
  sellerId: string;
  categoryId: string;
  name: string;
  description: string;
  price: string;
  quantity: number;
  imageUrl: string | null;
  seller: AdminProductSellerSummary;
  category: AdminProductCategorySummary;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminProductQuery {
  page: number;
  limit: number;
  search?: string;
  categoryId?: string;
  sellerId?: string;
}

export interface AdminProductsResult {
  products: AdminProductEntity[];
  pagination: AdminPagination;
}

export interface AdminPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminDashboardRepository {
  getDashboard(
    period: AdminDashboardPeriod,
  ): Promise<AdminDashboardSummary>;
  findUsers(query: AdminUserQuery): Promise<AdminUsersResult>;
  updateUserStatus(
    id: string,
    isActive: boolean,
  ): Promise<AdminUserEntity | null>;
  findSellers(query: AdminSellerQuery): Promise<AdminSellersResult>;
  findProducts(query: AdminProductQuery): Promise<AdminProductsResult>;
  deleteProduct(id: string): Promise<boolean>;
}
