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
  private readonly inventoryTransactions = new Set<string>();

  addProduct(product: ProductSeed): void {
    this.products.set(product.id, { ...product });
  }

  addCustomer(customer: CustomerSeed): void {
    this.customers.set(customer.id, { ...customer });
  }

  getProductQuantity(productId: string): number | null {
    return this.products.get(productId)?.quantity ?? null;
  }

  getInventoryTransactionCount(orderId: string): number {
    return [...this.inventoryTransactions].filter((transaction) =>
      transaction.startsWith(`${orderId}:`),
    ).length;
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
        totalCents += toCents(product.price) * item.quantity;

        return {
          id: randomUUID(),
          orderId,
          productId: product.id,
          quantity: item.quantity,
          unitPrice: Number(product.price).toFixed(2),
          subtotal: (
            (toCents(product.price) * item.quantity) /
            100
          ).toFixed(2),
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
      status: input.status,
      paymentMethod: input.paymentMethod,
      totalAmount: (totalCents / 100).toFixed(2),
      shippingFullName: input.shipping.fullName,
      shippingPhone: input.shipping.phone,
      shippingCity: input.shipping.city,
      shippingAddress: input.shipping.address,
      shippingNotes: input.shipping.notes ?? null,
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

    for (const { item, product } of requestedProducts) {
      product.quantity -= item.quantity;
      this.inventoryTransactions.add(
        inventoryTransactionKey(order.id, product.id, "SHIPMENT"),
      );
    }

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
    if (order.status === status) {
      return order;
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
    if (
      options.onlyIfPending &&
      order.status !== "PENDING_PAYMENT" &&
      order.status !== "PENDING_PAYMENT_VERIFICATION" &&
      order.status !== "PENDING_CONFIRMATION" &&
      order.status !== "PENDING"
    ) {
      throw new OrderNotPendingError();
    }

    if (order.status !== "DELIVERED") {
      for (const item of order.items) {
        const product = this.products.get(item.productId);
        const shipmentKey = inventoryTransactionKey(
          order.id,
          item.productId,
          "SHIPMENT",
        );
        const cancellationKey = inventoryTransactionKey(
          order.id,
          item.productId,
          "CANCELLATION",
        );
        if (
          product &&
          this.inventoryTransactions.has(shipmentKey) &&
          !this.inventoryTransactions.has(cancellationKey)
        ) {
          product.quantity += item.quantity;
          this.inventoryTransactions.add(cancellationKey);
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

function inventoryTransactionKey(
  orderId: string,
  productId: string,
  type: "SHIPMENT" | "CANCELLATION",
): string {
  return `${orderId}:${productId}:${type}`;
}
