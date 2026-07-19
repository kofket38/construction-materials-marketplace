import {
  InsufficientProductStockError,
  OrderAlreadyCancelledError,
  OrderCustomerNotFoundError,
  OrderNotPendingError,
  OrderProductNotFoundError,
  OrderStateChangedError,
  OrderTerminalStatusError,
  OwnProductOrderError,
} from "../repositories/order.errors.js";
import type {
  OrderEntity,
  OrderRepository,
} from "../repositories/order.repository.js";
import type { AuthenticatedUser } from "../types/auth.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../utils/api-error.js";
import type {
  CreateOrderBody,
  UpdateOrderStatusBody,
} from "../validators/order.validators.js";

export class OrderService {
  constructor(private readonly orders: OrderRepository) {}

  async create(
    actor: AuthenticatedUser,
    input: CreateOrderBody,
  ): Promise<OrderEntity> {
    this.requireCustomer(actor);

    try {
      return await this.orders.create({
        customerId: actor.userId,
        items: input.items,
      });
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  async findById(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<OrderEntity> {
    const order = await this.requireOrder(id);

    if (actor.role !== "ADMIN" && order.customerId !== actor.userId) {
      throw new ForbiddenError("You can only view your own orders.");
    }

    return order;
  }

  findMyOrders(actor: AuthenticatedUser): Promise<OrderEntity[]> {
    return this.orders.findByCustomerId(actor.userId);
  }

  async updateStatus(
    id: string,
    actor: AuthenticatedUser,
    input: UpdateOrderStatusBody,
  ): Promise<OrderEntity> {
    this.requireAdmin(actor);

    try {
      const order =
        input.status === "CANCELLED"
          ? await this.orders.cancel(id, { onlyIfPending: false })
          : await this.orders.updateStatus(id, input.status);

      if (!order) {
        throw new NotFoundError("Order not found.");
      }

      return order;
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  async cancel(id: string, actor: AuthenticatedUser): Promise<void> {
    const order = await this.requireOrder(id);
    const isAdmin = actor.role === "ADMIN";

    if (!isAdmin && order.customerId !== actor.userId) {
      throw new ForbiddenError("You can only cancel your own orders.");
    }
    if (!isAdmin && order.status !== "PENDING") {
      throw new ConflictError(
        "Only pending orders can be cancelled by customers.",
      );
    }

    try {
      if (
        !(await this.orders.cancel(id, {
          onlyIfPending: !isAdmin,
        }))
      ) {
        throw new NotFoundError("Order not found.");
      }
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  private async requireOrder(id: string): Promise<OrderEntity> {
    const order = await this.orders.findById(id);
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    return order;
  }

  private requireCustomer(actor: AuthenticatedUser): void {
    if (actor.role !== "CUSTOMER") {
      throw new ForbiddenError("Customer access is required.");
    }
  }

  private requireAdmin(actor: AuthenticatedUser): void {
    if (actor.role !== "ADMIN") {
      throw new ForbiddenError("Administrator access is required.");
    }
  }

  private handleRepositoryError(error: unknown): never {
    if (error instanceof OrderProductNotFoundError) {
      throw new NotFoundError(error.message);
    }
    if (error instanceof InsufficientProductStockError) {
      throw new ConflictError(error.message);
    }
    if (error instanceof OwnProductOrderError) {
      throw new ForbiddenError(error.message);
    }
    if (error instanceof OrderCustomerNotFoundError) {
      throw new UnauthorizedError(error.message);
    }
    if (
      error instanceof OrderNotPendingError ||
      error instanceof OrderAlreadyCancelledError ||
      error instanceof OrderTerminalStatusError ||
      error instanceof OrderStateChangedError
    ) {
      throw new ConflictError(error.message);
    }

    throw error;
  }
}
