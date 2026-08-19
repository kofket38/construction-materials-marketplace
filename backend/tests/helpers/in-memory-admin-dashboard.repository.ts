import { AdminProductInUseError } from "../../src/repositories/admin-dashboard.errors.js";
import type {
  AdminDashboardPeriod,
  AdminDashboardRepository,
  AdminDashboardSummary,
  AdminOrderEntity,
  AdminOrderQuery,
  AdminOrdersResult,
  AdminPagination,
  AdminProductEntity,
  AdminProductQuery,
  AdminProductsResult,
  AdminSellerQuery,
  AdminSellersResult,
  AdminUserEntity,
  AdminUserQuery,
  AdminUsersResult,
} from "../../src/repositories/admin-dashboard.repository.js";
import type { OrderStatus } from "../../src/repositories/order.repository.js";
import type { UserEntity } from "../../src/repositories/user.repository.js";
import type { InMemoryUserRepository } from "./in-memory-user.repository.js";

export interface AdminSellerProfileSeed {
  userId: string;
  shopName: string;
  phone?: string;
  address?: string;
}

export interface AdminCategorySeed {
  id: string;
  name: string;
}

export interface AdminProductSeed {
  id: string;
  sellerId: string;
  categoryId: string;
  name: string;
  description?: string;
  price: string;
  quantity: number;
  imageUrl?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AdminOrderItemSeed {
  productId: string;
  quantity: number;
  price: string;
}

export interface AdminOrderSeed {
  id: string;
  customerId: string;
  status: OrderStatus;
  items: AdminOrderItemSeed[];
  createdAt?: Date;
  updatedAt?: Date;
}

interface SellerProfileRecord {
  userId: string;
  shopName: string;
  phone: string;
  address: string;
}

interface ProductRecord {
  id: string;
  sellerId: string;
  categoryId: string;
  name: string;
  description: string;
  price: string;
  quantity: number;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface OrderRecord {
  id: string;
  customerId: string;
  status: OrderStatus;
  items: AdminOrderItemSeed[];
  totalAmount: string;
  createdAt: Date;
  updatedAt: Date;
}

export class InMemoryAdminDashboardRepository
  implements AdminDashboardRepository
{
  private readonly sellerProfiles = new Map<string, SellerProfileRecord>();
  private readonly categories = new Map<string, AdminCategorySeed>();
  private readonly products = new Map<string, ProductRecord>();
  private readonly orders = new Map<string, OrderRecord>();

  constructor(private readonly users: InMemoryUserRepository) {}

  addSellerProfile(input: AdminSellerProfileSeed): void {
    this.sellerProfiles.set(input.userId, {
      userId: input.userId,
      shopName: input.shopName,
      phone: input.phone ?? "",
      address: input.address ?? "",
    });
  }

  addCategory(input: AdminCategorySeed): void {
    this.categories.set(input.id, { ...input });
  }

  addProduct(input: AdminProductSeed): void {
    const now = new Date();
    this.products.set(input.id, {
      id: input.id,
      sellerId: input.sellerId,
      categoryId: input.categoryId,
      name: input.name,
      description: input.description ?? "",
      price: formatMoney(input.price),
      quantity: input.quantity,
      imageUrl: input.imageUrl ?? null,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    });
  }

  addOrder(input: AdminOrderSeed): void {
    const now = new Date();
    this.orders.set(input.id, {
      id: input.id,
      customerId: input.customerId,
      status: input.status,
      items: input.items.map((item) => ({ ...item })),
      totalAmount: formatMoney(
        input.items.reduce(
          (total, item) => total + Number(item.price) * item.quantity,
          0,
        ),
      ),
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
    });
  }

  async getDashboard(
    period: AdminDashboardPeriod,
  ): Promise<AdminDashboardSummary> {
    const users = this.users.allUsers();
    const products = [...this.products.values()];
    const orders = [...this.orders.values()];
    const deliveredOrders = orders.filter(
      (order) =>
        order.status === "DELIVERED" || order.status === "COMPLETED",
    );
    const recentActivity = [
      ...sortByNewest(users)
        .slice(0, 5)
        .map((user) => ({
          type: "USER_REGISTERED" as const,
          entityId: user.id,
          label: `${user.name} registered as ${user.role.toLowerCase()}.`,
          createdAt: user.createdAt,
        })),
      ...sortByNewest(products)
        .slice(0, 5)
        .map((product) => ({
          type: "PRODUCT_CREATED" as const,
          entityId: product.id,
          label: `${this.requireUser(product.sellerId).name} added ${product.name}.`,
          createdAt: product.createdAt,
        })),
      ...sortByNewest(orders)
        .slice(0, 5)
        .map((order) => ({
          type: "ORDER_CREATED" as const,
          entityId: order.id,
          label: `${this.requireUser(order.customerId).name} placed a ${order.status.toLowerCase()} order.`,
          createdAt: order.createdAt,
        })),
    ]
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() ||
          left.type.localeCompare(right.type) ||
          left.entityId.localeCompare(right.entityId),
      )
      .slice(0, 10);

    return {
      totalUsers: users.length,
      totalCustomers: users.filter((user) => user.role === "CUSTOMER").length,
      totalSellers: users.filter((user) => user.role === "SELLER").length,
      totalProducts: products.length,
      totalCategories: this.categories.size,
      totalOrders: orders.length,
      totalRevenue: sumMoney(
        deliveredOrders.map((order) => order.totalAmount),
      ),
      monthlyRevenue: sumMoney(
        deliveredOrders
          .filter(
            (order) =>
              order.createdAt >= period.monthStart &&
              order.createdAt < period.nextMonthStart,
          )
          .map((order) => order.totalAmount),
      ),
      recentActivity,
    };
  }

  async findUsers(query: AdminUserQuery): Promise<AdminUsersResult> {
    const search = normalizeSearch(query.search);
    const users = sortByNewest(this.users.allUsers()).filter(
      (user) =>
        (query.role === undefined || user.role === query.role) &&
        (search === undefined ||
          includesSearch(user.name, search) ||
          includesSearch(user.email, search) ||
          includesSearch(user.company, search)),
    );

    return {
      users: paginate(users, query).map(mapAdminUser),
      pagination: pagination(query.page, query.limit, users.length),
    };
  }

  async updateUserStatus(
    id: string,
    isActive: boolean,
  ): Promise<AdminUserEntity | null> {
    const user = this.users.setActive(id, isActive);
    return user ? mapAdminUser(user) : null;
  }

  async findSellers(query: AdminSellerQuery): Promise<AdminSellersResult> {
    const search = normalizeSearch(query.search);
    const sellers = sortByNewest(
      this.users
        .allUsers()
        .filter((user) => user.role === "SELLER"),
    ).filter((seller) => {
      const profile = this.sellerProfiles.get(seller.id);
      return (
        search === undefined ||
        includesSearch(seller.name, search) ||
        includesSearch(seller.email, search) ||
        includesSearch(seller.company, search) ||
        includesSearch(profile?.shopName, search)
      );
    });

    return {
      sellers: paginate(sellers, query).map((seller) => {
        const profile = this.sellerProfiles.get(seller.id);
        const sellerProducts = [...this.products.values()].filter(
          (product) => product.sellerId === seller.id,
        );
        const sellerProductIds = new Set(
          sellerProducts.map((product) => product.id),
        );
        const sellerOrders = [...this.orders.values()].filter((order) =>
          order.items.some((item) => sellerProductIds.has(item.productId)),
        );
        const deliveredLineTotals = sellerOrders.flatMap((order) =>
          order.status === "DELIVERED" || order.status === "COMPLETED"
            ? order.items
                .filter((item) => sellerProductIds.has(item.productId))
                .map((item) => Number(item.price) * item.quantity)
            : [],
        );

        return {
          id: seller.id,
          name: seller.name,
          email: seller.email,
          phone: seller.phone,
          company: seller.company,
          shopName: profile?.shopName ?? null,
          shopPhone: profile?.phone ?? null,
          address: profile?.address ?? null,
          status: seller.isActive ? "ACTIVE" : "DISABLED",
          productCount: sellerProducts.length,
          orderCount: sellerOrders.length,
          revenue: formatMoney(
            deliveredLineTotals.reduce((total, value) => total + value, 0),
          ),
          createdAt: seller.createdAt,
          updatedAt: seller.updatedAt,
        };
      }),
      pagination: pagination(query.page, query.limit, sellers.length),
    };
  }

  async findProducts(
    query: AdminProductQuery,
  ): Promise<AdminProductsResult> {
    const search = normalizeSearch(query.search);
    const products = sortByNewest([...this.products.values()]).filter(
      (product) => {
        const seller = this.requireUser(product.sellerId);
        const profile = this.sellerProfiles.get(product.sellerId);
        const category = this.requireCategory(product.categoryId);

        return (
          (query.categoryId === undefined ||
            product.categoryId === query.categoryId) &&
          (query.sellerId === undefined ||
            product.sellerId === query.sellerId) &&
          (search === undefined ||
            includesSearch(product.name, search) ||
            includesSearch(product.description, search) ||
            includesSearch(category.name, search) ||
            includesSearch(seller.name, search) ||
            includesSearch(seller.email, search) ||
            includesSearch(profile?.shopName, search))
        );
      },
    );

    return {
      products: paginate(products, query).map((product) =>
        this.mapAdminProduct(product),
      ),
      pagination: pagination(query.page, query.limit, products.length),
    };
  }

  async findOrders(query: AdminOrderQuery): Promise<AdminOrdersResult> {
    const search = normalizeSearch(query.search);
    const orders = sortByNewest([...this.orders.values()]).filter((order) => {
      const customer = this.users.allUsers().find((u) => u.id === order.customerId);
      const matchesStatus =
        query.status === undefined || order.status === query.status;
      const matchesSearch =
        search === undefined ||
        order.id.toLowerCase().startsWith(search) ||
        includesSearch(customer?.name, search) ||
        includesSearch(customer?.email, search);
      return matchesStatus && matchesSearch;
      // paymentStatus not tracked in in-memory — ignored for test helper
    });

    return {
      orders: paginate(orders, query).map((order) => {
        const customer = this.users.allUsers().find((u) => u.id === order.customerId);
        return {
          id: order.id,
          customerId: order.customerId,
          customer: {
            id: order.customerId,
            name: customer?.name ?? "Unknown",
            email: customer?.email ?? "",
          },
          status: order.status,
          paymentMethod: "CASH_ON_DELIVERY",
          totalAmount: order.totalAmount,
          shippingFullName: "Test Customer",
          shippingPhone: "+251911000000",
          shippingCity: "Addis Ababa",
          shippingAddress: "Test Address",
          shippingNotes: null,
          itemCount: order.items.length,
          items: order.items.map((item) => {
            const product = this.products.get(item.productId);
            return {
              id: `${order.id}:${item.productId}`,
              productId: item.productId,
              productName: product?.name ?? item.productId,
              productImageUrl: null,
              sellerId: product?.sellerId ?? "",
              quantity: item.quantity,
              unitPrice: item.price,
              subtotal: formatMoney(Number(item.price) * item.quantity),
            };
          }),
          payment: null,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        } satisfies AdminOrderEntity;
      }),
      pagination: pagination(query.page, query.limit, orders.length),
    };
  }

  async deleteProduct(id: string): Promise<boolean> {
    if (!this.products.has(id)) {
      return false;
    }
    if (
      [...this.orders.values()].some((order) =>
        order.items.some((item) => item.productId === id),
      )
    ) {
      throw new AdminProductInUseError();
    }

    this.products.delete(id);
    return true;
  }

  private mapAdminProduct(product: ProductRecord): AdminProductEntity {
    const seller = this.requireUser(product.sellerId);
    const category = this.requireCategory(product.categoryId);

    return {
      id: product.id,
      sellerId: product.sellerId,
      categoryId: product.categoryId,
      name: product.name,
      description: product.description,
      price: product.price,
      quantity: product.quantity,
      imageUrl: product.imageUrl,
      seller: {
        id: seller.id,
        name: seller.name,
        email: seller.email,
        shopName:
          this.sellerProfiles.get(product.sellerId)?.shopName ?? null,
      },
      category,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private requireUser(id: string): UserEntity {
    const user = this.users.allUsers().find((candidate) => candidate.id === id);
    if (!user) {
      throw new Error(`User ${id} does not exist.`);
    }
    return user;
  }

  private requireCategory(id: string): AdminCategorySeed {
    const category = this.categories.get(id);
    if (!category) {
      throw new Error(`Category ${id} does not exist.`);
    }
    return category;
  }
}

function mapAdminUser(user: UserEntity): AdminUserEntity {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    company: user.company,
    role: user.role,
    status: user.isActive ? "ACTIVE" : "DISABLED",
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function sortByNewest<T extends { id: string; createdAt: Date }>(
  values: T[],
): T[] {
  return [...values].sort(
    (left, right) =>
      right.createdAt.getTime() - left.createdAt.getTime() ||
      left.id.localeCompare(right.id),
  );
}

function paginate<T>(
  values: T[],
  query: { page: number; limit: number },
): T[] {
  const start = (query.page - 1) * query.limit;
  return values.slice(start, start + query.limit);
}

function pagination(
  page: number,
  limit: number,
  total: number,
): AdminPagination {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

function normalizeSearch(value: string | undefined): string | undefined {
  return value?.trim().toLowerCase();
}

function includesSearch(
  value: string | null | undefined,
  search: string,
): boolean {
  return value?.toLowerCase().includes(search) ?? false;
}

function sumMoney(values: string[]): string {
  return formatMoney(
    values.reduce((total, value) => total + Number(value), 0),
  );
}

function formatMoney(value: string | number): string {
  return Number(value).toFixed(2);
}
