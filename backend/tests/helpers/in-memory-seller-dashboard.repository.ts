import { randomUUID } from "node:crypto";
import type { OrderStatus } from "../../src/repositories/order.repository.js";
import type { ProductEntity } from "../../src/repositories/product.repository.js";
import type {
  SellerAnalytics,
  SellerAnalyticsPeriod,
  SellerDashboardPeriod,
  SellerDashboardRepository,
  SellerDashboardSummary,
  SellerOrderEntity,
  SellerOrderQuery,
  SellerOrdersResult,
  SellerProductQuery,
  SellerProductsResult,
} from "../../src/repositories/seller-dashboard.repository.js";

export interface SellerDashboardProductSeed {
  id?: string;
  sellerId: string;
  sellerName?: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description?: string;
  price: string;
  quantity: number;
  imageUrl?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SellerDashboardOrderSeed {
  id?: string;
  customer: {
    id: string;
    name: string;
    email: string;
  };
  status: OrderStatus;
  items: Array<{
    id?: string;
    productId: string;
    quantity: number;
    price: string;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
}

interface StoredOrder {
  id: string;
  customer: SellerDashboardOrderSeed["customer"];
  status: OrderStatus;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    price: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export class InMemorySellerDashboardRepository
  implements SellerDashboardRepository
{
  private readonly products = new Map<string, ProductEntity>();
  private readonly orders = new Map<string, StoredOrder>();

  addProduct(seed: SellerDashboardProductSeed): ProductEntity {
    const now = seed.createdAt ?? new Date();
    const product: ProductEntity = {
      id: seed.id ?? randomUUID(),
      sellerId: seed.sellerId,
      categoryId: seed.categoryId,
      name: seed.name,
      description: seed.description ?? `${seed.name} description`,
      price: money(seed.price),
      quantity: seed.quantity,
      imageUrl: seed.imageUrl ?? null,
      seller: {
        id: seed.sellerId,
        name: seed.sellerName ?? "Test Seller",
      },
      category: {
        id: seed.categoryId,
        name: seed.categoryName,
      },
      createdAt: now,
      updatedAt: seed.updatedAt ?? now,
    };

    this.products.set(product.id, product);
    return product;
  }

  addOrder(seed: SellerDashboardOrderSeed): string {
    const now = seed.createdAt ?? new Date();
    const order: StoredOrder = {
      id: seed.id ?? randomUUID(),
      customer: { ...seed.customer },
      status: seed.status,
      items: seed.items.map((item) => ({
        id: item.id ?? randomUUID(),
        productId: item.productId,
        quantity: item.quantity,
        price: money(item.price),
      })),
      createdAt: now,
      updatedAt: seed.updatedAt ?? now,
    };

    this.orders.set(order.id, order);
    return order.id;
  }

  async getDashboard(
    sellerId: string,
    period: SellerDashboardPeriod,
  ): Promise<SellerDashboardSummary> {
    const products = this.sellerProducts(sellerId);
    const orders = this.sellerOrders(sellerId);
    const delivered = orders.filter((order) => order.status === "DELIVERED");

    return {
      totalProducts: products.length,
      activeProducts: products.filter((product) => product.quantity > 0).length,
      totalOrders: orders.length,
      pendingOrders: orders.filter((order) => order.status === "PENDING").length,
      completedOrders: delivered.length,
      cancelledOrders: orders.filter((order) => order.status === "CANCELLED")
        .length,
      totalRevenue: money(
        delivered.reduce(
          (total, order) => total + this.sellerRevenue(order, sellerId),
          0,
        ),
      ),
      monthlyRevenue: money(
        delivered
          .filter(
            (order) =>
              order.createdAt >= period.monthStart &&
              order.createdAt < period.nextMonthStart,
          )
          .reduce(
            (total, order) => total + this.sellerRevenue(order, sellerId),
            0,
          ),
      ),
      recentOrders: orders
        .sort(compareOrdersNewestFirst)
        .slice(0, 10)
        .map((order) => this.mapOrder(order, sellerId)),
    };
  }

  async findProducts(
    sellerId: string,
    query: SellerProductQuery,
  ): Promise<SellerProductsResult> {
    const normalizedSearch = query.search?.toLocaleLowerCase();
    const products = this.sellerProducts(sellerId)
      .filter(
        (product) =>
          normalizedSearch === undefined ||
          product.name.toLocaleLowerCase().includes(normalizedSearch) ||
          product.description.toLocaleLowerCase().includes(normalizedSearch) ||
          product.category.name
            .toLocaleLowerCase()
            .includes(normalizedSearch),
      )
      .filter(
        (product) =>
          query.categoryId === undefined ||
          product.categoryId === query.categoryId,
      )
      .filter((product) => matchesStock(product.quantity, query.stock))
      .sort((left, right) => compareProducts(left, right, query));
    const total = products.length;

    return {
      products: products
        .slice((query.page - 1) * query.limit, query.page * query.limit)
        .map(copyProduct),
      pagination: pagination(query.page, query.limit, total),
    };
  }

  async findOrders(
    sellerId: string,
    query: SellerOrderQuery,
  ): Promise<SellerOrdersResult> {
    const customerSearch = query.customerSearch?.toLocaleLowerCase();
    const orders = this.sellerOrders(sellerId)
      .filter(
        (order) =>
          query.status === undefined || order.status === query.status,
      )
      .filter(
        (order) =>
          query.dateFrom === undefined || order.createdAt >= query.dateFrom,
      )
      .filter(
        (order) =>
          query.dateToExclusive === undefined ||
          order.createdAt < query.dateToExclusive,
      )
      .filter(
        (order) =>
          customerSearch === undefined ||
          order.customer.name.toLocaleLowerCase().includes(customerSearch) ||
          order.customer.email.toLocaleLowerCase().includes(customerSearch),
      )
      .sort(compareOrdersNewestFirst);
    const total = orders.length;

    return {
      orders: orders
        .slice((query.page - 1) * query.limit, query.page * query.limit)
        .map((order) => this.mapOrder(order, sellerId)),
      pagination: pagination(query.page, query.limit, total),
    };
  }

  async getAnalytics(
    sellerId: string,
    period: SellerAnalyticsPeriod,
  ): Promise<SellerAnalytics> {
    const sellerOrders = this.sellerOrders(sellerId);
    const delivered = sellerOrders.filter(
      (order) => order.status === "DELIVERED",
    );
    const productSales = new Map<
      string,
      { name: string; unitsSold: number; revenue: number }
    >();
    const categorySales = new Map<
      string,
      { name: string; unitsSold: number; revenue: number }
    >();
    const monthly = new Map<
      string,
      { orderIds: Set<string>; unitsSold: number; revenue: number }
    >();

    for (const order of delivered) {
      for (const item of this.sellerItems(order, sellerId)) {
        const product = this.requireProduct(item.productId);
        const lineRevenue = Number(item.price) * item.quantity;
        const productTotal = productSales.get(product.id) ?? {
          name: product.name,
          unitsSold: 0,
          revenue: 0,
        };
        productTotal.unitsSold += item.quantity;
        productTotal.revenue += lineRevenue;
        productSales.set(product.id, productTotal);

        const categoryTotal = categorySales.get(product.categoryId) ?? {
          name: product.category.name,
          unitsSold: 0,
          revenue: 0,
        };
        categoryTotal.unitsSold += item.quantity;
        categoryTotal.revenue += lineRevenue;
        categorySales.set(product.categoryId, categoryTotal);

        if (
          order.createdAt >= period.startDate &&
          order.createdAt < period.endDate
        ) {
          const month = monthKey(order.createdAt);
          const monthTotal = monthly.get(month) ?? {
            orderIds: new Set<string>(),
            unitsSold: 0,
            revenue: 0,
          };
          monthTotal.orderIds.add(order.id);
          monthTotal.unitsSold += item.quantity;
          monthTotal.revenue += lineRevenue;
          monthly.set(month, monthTotal);
        }
      }
    }

    const monthlyEntries = [...monthly.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    );

    return {
      period: {
        startDate: period.startDate,
        endDate: period.endDate,
      },
      bestSellingProducts: [...productSales.entries()]
        .sort(
          ([, left], [, right]) =>
            right.unitsSold - left.unitsSold ||
            right.revenue - left.revenue ||
            left.name.localeCompare(right.name),
        )
        .slice(0, 10)
        .map(([productId, product]) => ({
          productId,
          name: product.name,
          unitsSold: product.unitsSold,
          revenue: money(product.revenue),
        })),
      monthlySales: monthlyEntries.map(([month, values]) => ({
        month,
        orders: values.orderIds.size,
        unitsSold: values.unitsSold,
      })),
      revenueByMonth: monthlyEntries.map(([month, values]) => ({
        month,
        revenue: money(values.revenue),
      })),
      ordersByStatus: orderStatuses.map((status) => ({
        status,
        count: sellerOrders.filter((order) => order.status === status).length,
      })),
      topCategories: [...categorySales.entries()]
        .sort(
          ([, left], [, right]) =>
            right.revenue - left.revenue ||
            right.unitsSold - left.unitsSold ||
            left.name.localeCompare(right.name),
        )
        .slice(0, 10)
        .map(([categoryId, category]) => ({
          categoryId,
          name: category.name,
          unitsSold: category.unitsSold,
          revenue: money(category.revenue),
        })),
    };
  }

  private sellerProducts(sellerId: string): ProductEntity[] {
    return [...this.products.values()].filter(
      (product) => product.sellerId === sellerId,
    );
  }

  private sellerOrders(sellerId: string): StoredOrder[] {
    return [...this.orders.values()].filter(
      (order) => this.sellerItems(order, sellerId).length > 0,
    );
  }

  private sellerItems(order: StoredOrder, sellerId: string) {
    return order.items.filter(
      (item) => this.requireProduct(item.productId).sellerId === sellerId,
    );
  }

  private sellerRevenue(order: StoredOrder, sellerId: string): number {
    return this.sellerItems(order, sellerId).reduce(
      (total, item) => total + Number(item.price) * item.quantity,
      0,
    );
  }

  private mapOrder(order: StoredOrder, sellerId: string): SellerOrderEntity {
    let sellerTotal = 0;
    let totalItems = 0;
    const items = this.sellerItems(order, sellerId).map((item) => {
      const product = this.requireProduct(item.productId);
      const lineTotal = Number(item.price) * item.quantity;
      sellerTotal += lineTotal;
      totalItems += item.quantity;

      return {
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        price: money(item.price),
        lineTotal: money(lineTotal),
        product: {
          id: product.id,
          name: product.name,
          imageUrl: product.imageUrl,
          category: { ...product.category },
        },
      };
    });

    return {
      id: order.id,
      customerId: order.customer.id,
      customer: { ...order.customer },
      status: order.status,
      sellerTotal: money(sellerTotal),
      totalItems,
      items,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private requireProduct(productId: string): ProductEntity {
    const product = this.products.get(productId);
    if (!product) {
      throw new Error(`Test product ${productId} was not found.`);
    }
    return product;
  }
}

const orderStatuses: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

function matchesStock(
  quantity: number,
  stock: SellerProductQuery["stock"],
): boolean {
  switch (stock) {
    case "in_stock":
      return quantity > 0;
    case "low_stock":
      return quantity > 0 && quantity <= 10;
    case "out_of_stock":
      return quantity === 0;
    default:
      return true;
  }
}

function compareProducts(
  left: ProductEntity,
  right: ProductEntity,
  query: SellerProductQuery,
): number {
  let result: number;

  switch (query.sortBy) {
    case "name":
      result = left.name.localeCompare(right.name);
      break;
    case "price":
      result = Number(left.price) - Number(right.price);
      break;
    case "quantity":
      result = left.quantity - right.quantity;
      break;
    case "createdAt":
      result = left.createdAt.getTime() - right.createdAt.getTime();
      break;
  }

  return (query.sortOrder === "asc" ? result : -result) ||
    left.id.localeCompare(right.id);
}

function compareOrdersNewestFirst(
  left: StoredOrder,
  right: StoredOrder,
): number {
  return (
    right.createdAt.getTime() - left.createdAt.getTime() ||
    left.id.localeCompare(right.id)
  );
}

function copyProduct(product: ProductEntity): ProductEntity {
  return {
    ...product,
    seller: { ...product.seller },
    category: { ...product.category },
  };
}

function pagination(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}`;
}

function money(value: string | number): string {
  return Number(value).toFixed(2);
}
