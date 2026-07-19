import { randomUUID } from "node:crypto";
import {
  InsufficientProductStockError,
  OrderAlreadyCancelledError,
  OrderNotPendingError,
  OrderProductNotFoundError,
  OrderTerminalStatusError,
  OwnProductOrderError,
} from "../../src/repositories/order.errors.js";
import type {
  CancelOrderOptions,
  CreateOrderInput,
  OrderEntity,
  OrderItemEntity,
  OrderProductSummary,
  OrderRepository,
  OrderStatus,
} from "../../src/repositories/order.repository.js";

interface ProductSeed extends OrderProductSummary {
  price: string;
  quantity: number;
}

interface CustomerSeed {
  id: string;
  name: string;
  email: string;
}

export class InMemoryOrderRepository implements OrderRepository {
  private readonly products = new Map<string, ProductSeed>();
  private readonly customers = new Map<string, CustomerSeed>();
  private readonly orders = new Map<string, OrderEntity>();

  addProduct(product: ProductSeed): void {
    this.products.set(product.id, { ...product });
  }

  addCustomer(customer: CustomerSeed): void {
    this.customers.set(customer.id, { ...customer });
  }

  getProductQuantity(productId: string): number | null {
    return this.products.get(productId)?.quantity ?? null;
  }

  async create(input: CreateOrderInput): Promise<OrderEntity> {
    const requestedProducts = input.items.map((item) => {
      const product = this.products.get(item.productId);
      if (!product) {
        throw new OrderProductNotFoundError(item.productId);
      }
      if (product.sellerId === input.customerId) {
        throw new OwnProductOrderError();
      }
      if (product.quantity < item.quantity) {
        throw new InsufficientProductStockError(item.productId);
      }
      return { item, product };
    });

    const orderId = randomUUID();
    const now = new Date();
    let totalCents = 0;

    const items: OrderItemEntity[] = requestedProducts.map(
      ({ item, product }) => {
        product.quantity -= item.quantity;
        totalCents += toCents(product.price) * item.quantity;

        return {
          id: randomUUID(),
          orderId,
          productId: product.id,
          quantity: item.quantity,
          price: Number(product.price).toFixed(2),
          product: {
            id: product.id,
            sellerId: product.sellerId,
            name: product.name,
            imageUrl: product.imageUrl,
          },
        };
      },
    );

    const order: OrderEntity = {
      id: orderId,
      customerId: input.customerId,
      status: "PENDING",
      totalAmount: (totalCents / 100).toFixed(2),
      customer:
        this.customers.get(input.customerId) ??
        {
          id: input.customerId,
          name: "Test Customer",
          email: "customer@example.com",
        },
      items,
      createdAt: now,
      updatedAt: now,
    };

    this.orders.set(order.id, order);
    return order;
  }

  async findById(id: string): Promise<OrderEntity | null> {
    return this.orders.get(id) ?? null;
  }

  async findByCustomerId(customerId: string): Promise<OrderEntity[]> {
    return [...this.orders.values()]
      .filter((order) => order.customerId === customerId)
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime(),
      );
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
  ): Promise<OrderEntity | null> {
    const order = this.orders.get(id);
    if (!order) {
      return null;
    }
    if (
      order.status === "CANCELLED" ||
      (order.status === "DELIVERED" && status !== "DELIVERED")
    ) {
      throw new OrderTerminalStatusError();
    }

    order.status = status;
    order.updatedAt = new Date();
    return order;
  }

  async cancel(
    id: string,
    options: CancelOrderOptions,
  ): Promise<OrderEntity | null> {
    const order = this.orders.get(id);
    if (!order) {
      return null;
    }
    if (order.status === "CANCELLED") {
      throw new OrderAlreadyCancelledError();
    }
    if (options.onlyIfPending && order.status !== "PENDING") {
      throw new OrderNotPendingError();
    }

    if (order.status !== "DELIVERED") {
      for (const item of order.items) {
        const product = this.products.get(item.productId);
        if (product) {
          product.quantity += item.quantity;
        }
      }
    }

    order.status = "CANCELLED";
    order.updatedAt = new Date();
    return order;
  }
}

function toCents(value: string): number {
  return Math.round(Number(value) * 100);
}
