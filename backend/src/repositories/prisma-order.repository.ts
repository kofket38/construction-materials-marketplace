import {
  OrderStatus as PrismaOrderStatus,
  PaymentStatus as PrismaPaymentStatus,
  Prisma,
  type PrismaClient,
} from "../prisma/generated/client.js";
import {
  InsufficientProductStockError,
  OrderAlreadyCancelledError,
  OrderCustomerNotFoundError,
  OrderNotPendingError,
  OrderProductNotFoundError,
  OrderStateChangedError,
  OrderTerminalStatusError,
  OwnProductOrderError,
  SellerInventoryNotFoundError,
} from "./order.errors.js";
import type {
  CancelOrderOptions,
  CreateOrderInput,
  OrderEntity,
  OrderRepository,
  OrderStatus,
} from "./order.repository.js";
import {
  reserveOrderInventory,
  restoreOrderInventory,
} from "./order-inventory.js";

const orderRelations = {
  customer: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  items: {
    include: {
      product: {
        select: {
          id: true,
          sellerId: true,
          name: true,
          imageUrl: true,
        },
      },
    },
    orderBy: {
      id: "asc",
    },
  },
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof orderRelations;
}>;

function mapOrder(order: OrderWithRelations): OrderEntity {
  return {
    id: order.id,
    customerId: order.customerId,
    status: order.status as OrderStatus,
    paymentMethod: order.paymentMethod,
    totalAmount: order.totalAmount.toFixed(2),
    shippingFullName: order.shippingFullName,
    shippingPhone: order.shippingPhone,
    shippingCity: order.shippingCity,
    shippingAddress: order.shippingAddress,
    shippingNotes: order.shippingNotes,
    customer: order.customer,
    items: order.items.map((item) => ({
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
      subtotal: item.subtotal.toFixed(2),
      price: item.price.toFixed(2),
      product: item.product,
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly client: PrismaClient) {}

  async create(input: CreateOrderInput): Promise<OrderEntity> {
    try {
      return await this.client.$transaction(async (transaction) => {
        let totalAmount = new Prisma.Decimal(0);
        const orderItems: Array<{
          productId: string;
          quantity: number;
          unitPrice: Prisma.Decimal;
          subtotal: Prisma.Decimal;
          price: Prisma.Decimal;
        }> = [];

        for (const requestedItem of input.items) {
          // Own-product guard: still derived from the canonical Product row.
          const product = await transaction.product.findUnique({
            where: { id: requestedItem.productId },
            select: { id: true, sellerId: true },
          });

          if (!product) {
            throw new OrderProductNotFoundError(requestedItem.productId);
          }
          if (product.sellerId === input.customerId) {
            throw new OwnProductOrderError();
          }

          // Authoritative price and stock come from SellerInventory.
          const inventory = await transaction.sellerInventory.findUnique({
            where: {
              sellerId_productId: {
                sellerId: requestedItem.sellerId,
                productId: requestedItem.productId,
              },
            },
            select: { price: true, quantity: true },
          });

          if (!inventory) {
            throw new SellerInventoryNotFoundError(
              requestedItem.productId,
              requestedItem.sellerId,
            );
          }
          if (inventory.quantity < requestedItem.quantity) {
            throw new InsufficientProductStockError(requestedItem.productId);
          }

          const subtotal = inventory.price.mul(requestedItem.quantity);
          totalAmount = totalAmount.plus(subtotal);
          orderItems.push({
            productId: product.id,
            quantity: requestedItem.quantity,
            unitPrice: inventory.price,
            subtotal,
            price: inventory.price,
          });
        }

        const order = await transaction.order.create({
          data: {
            customerId: input.customerId,
            status: input.status,
            paymentMethod: input.paymentMethod,
            totalAmount,
            shippingFullName: input.shipping.fullName,
            shippingPhone: input.shipping.phone,
            shippingCity: input.shipping.city,
            shippingAddress: input.shipping.address,
            shippingNotes: input.shipping.notes || null,
            items: {
              create: orderItems,
            },
          },
          include: orderRelations,
        });

        // reserveOrderInventory now receives sellerId per item so it can
        // operate on SellerInventory rows rather than Product.quantity.
        await reserveOrderInventory(transaction, order.id, input.items);

        return mapOrder(order);
      }, { timeout: 30_000, maxWait: 10_000 });
    } catch (error) {
      if (hasPrismaCode(error, "P2003")) {
        throw new OrderCustomerNotFoundError();
      }
      throw error;
    }
  }

  async findById(id: string): Promise<OrderEntity | null> {
    const order = await this.client.order.findUnique({
      where: { id },
      include: orderRelations,
    });

    return order ? mapOrder(order) : null;
  }

  async findByCustomerId(customerId: string): Promise<OrderEntity[]> {
    const orders = await this.client.order.findMany({
      where: { customerId },
      include: orderRelations,
      orderBy: { createdAt: "desc" },
    });

    return orders.map(mapOrder);
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
  ): Promise<OrderEntity | null> {
    return this.client.$transaction(async (transaction) => {
      const currentOrder = await transaction.order.findUnique({
        where: { id },
        select: { status: true },
      });

      if (!currentOrder) {
        return null;
      }
      if (
        currentOrder.status === PrismaOrderStatus.CANCELLED ||
        ((currentOrder.status === PrismaOrderStatus.DELIVERED ||
          currentOrder.status === PrismaOrderStatus.COMPLETED) &&
          status !== currentOrder.status)
      ) {
        throw new OrderTerminalStatusError();
      }
      if (currentOrder.status === PrismaOrderStatus[status]) {
        const order = await transaction.order.findUnique({
          where: { id },
          include: orderRelations,
        });

        return order ? mapOrder(order) : null;
      }

      const updated = await transaction.order.updateMany({
        where: {
          id,
          status: currentOrder.status,
        },
        data: {
          status: PrismaOrderStatus[status],
        },
      });

      if (updated.count !== 1) {
        throw new OrderStateChangedError();
      }
      const order = await transaction.order.findUnique({
        where: { id },
        include: orderRelations,
      });

      return order ? mapOrder(order) : null;
    }, { timeout: 30_000, maxWait: 10_000 });
  }

  async rejectPayment(id: string): Promise<OrderEntity | null> {
    return this.client.$transaction(async (transaction) => {
      const currentOrder = await transaction.order.findUnique({
        where: { id },
        select: {
          status: true,
          payment: { select: { status: true } },
        },
      });

      if (!currentOrder) {
        return null;
      }

      // Concurrent-modification guard: both order and payment must still be
      // in the pending-verification state. This mirrors the seller's
      // verifyPayment transaction and prevents double-rejection.
      if (
        currentOrder.status !==
          PrismaOrderStatus.PENDING_PAYMENT_VERIFICATION ||
        currentOrder.payment?.status !==
          PrismaPaymentStatus.PENDING_VERIFICATION
      ) {
        throw new OrderStateChangedError();
      }

      const paymentUpdate = await transaction.payment.updateMany({
        where: {
          orderId: id,
          status: PrismaPaymentStatus.PENDING_VERIFICATION,
        },
        data: {
          status: PrismaPaymentStatus.REJECTED,
          verifiedAt: null,
        },
      });

      const orderUpdate = await transaction.order.updateMany({
        where: {
          id,
          status: PrismaOrderStatus.PENDING_PAYMENT_VERIFICATION,
        },
        data: { status: PrismaOrderStatus.PAYMENT_REJECTED },
      });

      if (paymentUpdate.count !== 1 || orderUpdate.count !== 1) {
        throw new OrderStateChangedError();
      }

      // Return reserved stock to SellerInventory (idempotent).
      await restoreOrderInventory(transaction, id);

      const updated = await transaction.order.findUnique({
        where: { id },
        include: orderRelations,
      });

      return updated ? mapOrder(updated) : null;
    }, { timeout: 30_000, maxWait: 10_000 });
  }

  async complete(
    id: string,
    customerId: string,
  ): Promise<OrderEntity | null> {
    return this.client.$transaction(async (transaction) => {
      const currentOrder = await transaction.order.findUnique({
        where: { id },
        select: {
          customerId: true,
          status: true,
        },
      });

      if (!currentOrder || currentOrder.customerId !== customerId) {
        return null;
      }
      if (currentOrder.status === PrismaOrderStatus.COMPLETED) {
        const order = await transaction.order.findUnique({
          where: { id },
          include: orderRelations,
        });
        return order ? mapOrder(order) : null;
      }
      if (currentOrder.status !== PrismaOrderStatus.DELIVERED) {
        throw new OrderStateChangedError();
      }

      const updated = await transaction.order.updateMany({
        where: {
          id,
          customerId,
          status: PrismaOrderStatus.DELIVERED,
        },
        data: {
          status: PrismaOrderStatus.COMPLETED,
        },
      });

      if (updated.count !== 1) {
        throw new OrderStateChangedError();
      }

      const order = await transaction.order.findUnique({
        where: { id },
        include: orderRelations,
      });

      return order ? mapOrder(order) : null;
    }, { timeout: 30_000, maxWait: 10_000 });
  }

  async cancel(
    id: string,
    options: CancelOrderOptions,
  ): Promise<OrderEntity | null> {
    return this.client.$transaction(async (transaction) => {
      const currentOrder = await transaction.order.findUnique({
        where: { id },
        include: {
          items: {
            select: {
              productId: true,
              quantity: true,
            },
          },
        },
      });

      if (!currentOrder) {
        return null;
      }

      if (currentOrder.status === PrismaOrderStatus.CANCELLED) {
        throw new OrderAlreadyCancelledError();
      }
      if (currentOrder.status === PrismaOrderStatus.COMPLETED) {
        throw new OrderTerminalStatusError();
      }

      if (
        options.onlyIfPending &&
        currentOrder.status !== PrismaOrderStatus.PENDING_PAYMENT &&
        currentOrder.status !==
          PrismaOrderStatus.PENDING_PAYMENT_VERIFICATION &&
        currentOrder.status !== PrismaOrderStatus.PENDING_CONFIRMATION &&
        currentOrder.status !== PrismaOrderStatus.PENDING
      ) {
        throw new OrderNotPendingError();
      }

      if (currentOrder.status !== PrismaOrderStatus.DELIVERED) {
        await restoreOrderInventory(transaction, id);
      }

      const cancelled = await transaction.order.updateMany({
        where: {
          id,
          status: currentOrder.status,
        },
        data: {
          status: PrismaOrderStatus.CANCELLED,
        },
      });

      if (cancelled.count !== 1) {
        throw new OrderStateChangedError();
      }

      const order = await transaction.order.findUnique({
        where: { id },
        include: orderRelations,
      });

      return order ? mapOrder(order) : null;
    }, { timeout: 30_000, maxWait: 10_000 });
  }
}
