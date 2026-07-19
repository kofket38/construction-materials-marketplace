import {
  OrderStatus as PrismaOrderStatus,
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
} from "./order.errors.js";
import type {
  CancelOrderOptions,
  CreateOrderInput,
  OrderEntity,
  OrderRepository,
  OrderStatus,
} from "./order.repository.js";

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
    totalAmount: order.totalAmount.toFixed(2),
    customer: order.customer,
    items: order.items.map((item) => ({
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      quantity: item.quantity,
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
          price: Prisma.Decimal;
        }> = [];

        for (const requestedItem of input.items) {
          const product = await transaction.product.findUnique({
            where: { id: requestedItem.productId },
            select: {
              id: true,
              sellerId: true,
              price: true,
            },
          });

          if (!product) {
            throw new OrderProductNotFoundError(requestedItem.productId);
          }
          if (product.sellerId === input.customerId) {
            throw new OwnProductOrderError();
          }

          const stockUpdate = await transaction.product.updateMany({
            where: {
              id: product.id,
              quantity: {
                gte: requestedItem.quantity,
              },
            },
            data: {
              quantity: {
                decrement: requestedItem.quantity,
              },
            },
          });

          if (stockUpdate.count !== 1) {
            const currentProduct = await transaction.product.findUnique({
              where: { id: product.id },
              select: { id: true },
            });

            if (!currentProduct) {
              throw new OrderProductNotFoundError(product.id);
            }
            throw new InsufficientProductStockError(product.id);
          }

          totalAmount = totalAmount.plus(
            product.price.mul(requestedItem.quantity),
          );
          orderItems.push({
            productId: product.id,
            quantity: requestedItem.quantity,
            price: product.price,
          });
        }

        const order = await transaction.order.create({
          data: {
            customerId: input.customerId,
            totalAmount,
            items: {
              create: orderItems,
            },
          },
          include: orderRelations,
        });

        return mapOrder(order);
      });
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
        (currentOrder.status === PrismaOrderStatus.DELIVERED &&
          status !== "DELIVERED")
      ) {
        throw new OrderTerminalStatusError();
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
    });
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
      if (
        options.onlyIfPending &&
        currentOrder.status !== PrismaOrderStatus.PENDING
      ) {
        throw new OrderNotPendingError();
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

      if (currentOrder.status !== PrismaOrderStatus.DELIVERED) {
        for (const item of currentOrder.items) {
          await transaction.product.update({
            where: { id: item.productId },
            data: {
              quantity: {
                increment: item.quantity,
              },
            },
          });
        }
      }

      const order = await transaction.order.findUnique({
        where: { id },
        include: orderRelations,
      });

      return order ? mapOrder(order) : null;
    });
  }
}
