import { randomUUID } from "node:crypto";
import {
  InsufficientProductStockError,
  OrderAlreadyCancelledError,
  OrderNotPendingError,
  OrderProductNotFoundError,
  OrderStateChangedError,
  OrderTerminalStatusError,
  OwnProductOrderError,
  SellerInventoryNotFoundError,
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

// Per-seller, per-product inventory entry used by the in-memory repo.
// Mirrors SellerInventory(sellerId, productId) → { price, quantity, city }.
interface InventorySeed {
  price: string;
  quantity: number;
  city: string;
}

export class InMemoryOrderRepository implements OrderRepository {
  private readonly products = new Map<string, ProductSeed>();
  private readonly customers = new Map<string, CustomerSeed>();
  private readonly orders = new Map<string, OrderEntity>();
  private readonly inventoryTransactions = new Set<string>();
  // key: `${sellerId}:${productId}`
  private readonly sellerInventory = new Map<string, InventorySeed>();

  addProduct(product: ProductSeed): void {
    this.products.set(product.id, { ...product });
  }

  addCustomer(customer: CustomerSeed): void {
    this.customers.set(customer.id, { ...customer });
  }

  /**
   * Seed a SellerInventory entry. If not called for a product/seller pair,
   * create() falls back to the ProductSeed price/quantity so existing tests
   * that do not call addInventory continue to work transparently.
   */
  addInventory(
    sellerId: string,
    productId: string,
    inventory: InventorySeed,
  ): void {
    this.sellerInventory.set(
      sellerInventoryKey(sellerId, productId),
      { ...inventory },
    );
  }

  getProductQuantity(productId: string): number | null {
    return this.products.get(productId)?.quantity ?? null;
  }

  getSellerInventoryQuantity(
    sellerId: string,
    productId: string,
  ): number | null {
    return (
      this.sellerInventory.get(sellerInventoryKey(sellerId, productId))
        ?.quantity ?? null
    );
  }

  getInventoryTransactionCount(orderId: string): number {
    return [...this.inventoryTransactions].filter((t) =>
      t.startsWith(`${orderId}:`),
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

      // Use SellerInventory when available; fall back to ProductSeed so
      // tests that don't seed inventory (pre-existing HTTP tests) still pass.
      const invKey = sellerInventoryKey(item.sellerId, item.productId);
      const inv = this.sellerInventory.get(invKey);

      if (inv) {
        if (inv.quantity < item.quantity) {
          throw new InsufficientProductStockError(item.productId);
        }
      } else {
        // No explicit inventory seed — check product-level stock.
        // This branch keeps all pre-existing orders.test.ts cases working.
        if (product.quantity < item.quantity) {
          throw new InsufficientProductStockError(item.productId);
        }
      }

      return { item, product, inv: inv ?? null };
    });

    const orderId = randomUUID();
    const now = new Date();
    let totalCents = 0;

    const items: OrderItemEntity[] = requestedProducts.map(
      ({ item, product, inv }) => {
        const unitPrice = inv ? inv.price : product.price;
        totalCents += toCents(unitPrice) * item.quantity;

        return {
          id: randomUUID(),
          orderId,
          productId: product.id,
          quantity: item.quantity,
          unitPrice: Number(unitPrice).toFixed(2),
          subtotal: (
            (toCents(unitPrice) * item.quantity) /
            100
          ).toFixed(2),
          price: Number(unitPrice).toFixed(2),
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
        this.customers.get(input.customerId) ?? {
          id: input.customerId,
          name: "Test Customer",
          email: "customer@example.com",
        },
      items,
      createdAt: now,
      updatedAt: now,
    };

    // Deduct from SellerInventory when present, otherwise deduct from product.
    for (const { item, product, inv } of requestedProducts) {
      if (inv) {
        inv.quantity -= item.quantity;
      } else {
        product.quantity -= item.quantity;
      }
      this.inventoryTransactions.add(
        inventoryTransactionKey(order.id, item.sellerId, product.id, "SHIPMENT"),
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
      ((order.status === "DELIVERED" || order.status === "COMPLETED") &&
        status !== order.status)
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

  async rejectPayment(id: string): Promise<OrderEntity | null> {
    const order = this.orders.get(id);
    if (!order) {
      return null;
    }

    // Concurrent-modification guard: order must still be awaiting verification.
    // The in-memory repo has no payment record, so we guard on order status only
    // (matching the invariant enforced by the real transaction).
    if (order.status !== "PENDING_PAYMENT_VERIFICATION") {
      throw new OrderStateChangedError();
    }

    // Restore reserved SellerInventory (idempotent via CANCELLATION key).
    for (const item of order.items) {
      const sellerId = item.product.sellerId;
      const invKey = sellerInventoryKey(sellerId, item.productId);
      const inv = this.sellerInventory.get(invKey);
      const shipmentKey = inventoryTransactionKey(
        order.id,
        sellerId,
        item.productId,
        "SHIPMENT",
      );
      const cancellationKey = inventoryTransactionKey(
        order.id,
        sellerId,
        item.productId,
        "CANCELLATION",
      );
      if (
        this.inventoryTransactions.has(shipmentKey) &&
        !this.inventoryTransactions.has(cancellationKey)
      ) {
        if (inv) {
          inv.quantity += item.quantity;
        } else {
          const product = this.products.get(item.productId);
          if (product) {
            product.quantity += item.quantity;
          }
        }
        this.inventoryTransactions.add(cancellationKey);
      }
    }

    order.status = "PAYMENT_REJECTED";
    order.updatedAt = new Date();
    return order;
  }

  async complete(
    id: string,
    customerId: string,
  ): Promise<OrderEntity | null> {
    const order = this.orders.get(id);
    if (!order || order.customerId !== customerId) {
      return null;
    }
    if (order.status === "COMPLETED") {
      return order;
    }
    if (order.status !== "DELIVERED") {
      throw new OrderStateChangedError();
    }
    order.status = "COMPLETED";
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
    if (order.status === "COMPLETED") {
      throw new OrderTerminalStatusError();
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
        const sellerId = item.product.sellerId;
        const invKey = sellerInventoryKey(sellerId, item.productId);
        const inv = this.sellerInventory.get(invKey);
        const shipmentKey = inventoryTransactionKey(
          order.id,
          sellerId,
          item.productId,
          "SHIPMENT",
        );
        const cancellationKey = inventoryTransactionKey(
          order.id,
          sellerId,
          item.productId,
          "CANCELLATION",
        );
        if (
          this.inventoryTransactions.has(shipmentKey) &&
          !this.inventoryTransactions.has(cancellationKey)
        ) {
          if (inv) {
            inv.quantity += item.quantity;
          } else {
            const product = this.products.get(item.productId);
            if (product) {
              product.quantity += item.quantity;
            }
          }
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

function sellerInventoryKey(sellerId: string, productId: string): string {
  return `${sellerId}:${productId}`;
}

function inventoryTransactionKey(
  orderId: string,
  sellerId: string,
  productId: string,
  type: "SHIPMENT" | "CANCELLATION",
): string {
  return `${orderId}:${sellerId}:${productId}:${type}`;
}
