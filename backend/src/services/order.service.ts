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
import type {
  ManualPaymentMethod,
  PaymentDestination,
} from "../types/payment.js";
import { isManualPaymentMethod } from "../types/payment.js";
import type { SellerPaymentRepository } from "../repositories/seller-payment.repository.js";
import {
  BadRequestError,
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
  constructor(
    private readonly orders: OrderRepository,
    private readonly sellerPayments: SellerPaymentRepository,
  ) {}

  async create(
    actor: AuthenticatedUser,
    input: CreateOrderBody,
  ): Promise<CreateOrderResult> {
    this.requireCustomer(actor);
    const paymentDestination = isManualPaymentMethod(input.paymentMethod)
      ? await this.requirePaymentDestination(
          input.items.map((item) => item.productId),
          input.paymentMethod,
        )
      : null;

    try {
      const order = await this.orders.create({
        customerId: actor.userId,
        items: input.items,
        paymentMethod: input.paymentMethod,
        shipping: {
          fullName: input.shipping.fullName,
          phone: input.shipping.phone,
          city: input.shipping.city,
          address: input.shipping.address,
          ...(input.shipping.notes !== undefined
            ? { notes: input.shipping.notes }
            : {}),
        },
        status: initialOrderStatus(input.paymentMethod),
      });

      if (paymentDestination) {
        return {
          order,
          manualPaymentInstructions: {
            paymentDestination,
            paymentReference: order.id,
            amount: order.totalAmount,
            receiptUploadInstructions:
              "Upload a clear screenshot of your transfer receipt for verification.",
          },
        };
      }

      return { order };
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
    this.requireCustomer(actor);
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
    if (!isAdmin && !isCustomerCancellableStatus(order.status)) {
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

  private async requirePaymentDestination(
    productIds: string[],
    method: ManualPaymentMethod,
  ): Promise<PaymentDestination> {
    const resolution =
      await this.sellerPayments.resolveCheckoutSellers(productIds);
    if (resolution.missingProductIds.length > 0) {
      throw new NotFoundError(
        "One or more products are no longer available.",
      );
    }
    if (resolution.sellerIds.length !== 1) {
      throw new BadRequestError(
        "Digital payment requires products from one seller. Choose cash on delivery or place separate orders.",
      );
    }

    const profile = await this.sellerPayments.findBySellerId(
      resolution.sellerIds[0]!,
    );
    const destination = profile?.destinations.find(
      (candidate) => candidate.method === method,
    );
    if (!destination) {
      throw new BadRequestError(
        "The seller has not configured this payment provider.",
      );
    }
    return destination;
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

export interface ManualPaymentInstructions {
  paymentDestination: PaymentDestination;
  paymentReference: string;
  amount: string;
  receiptUploadInstructions: string;
}

export interface CreateOrderResult {
  order: OrderEntity;
  manualPaymentInstructions?: ManualPaymentInstructions;
}

function initialOrderStatus(
  paymentMethod: CreateOrderBody["paymentMethod"],
): "PENDING_PAYMENT" | "PENDING_CONFIRMATION" {
  return paymentMethod === "CASH_ON_DELIVERY"
    ? "PENDING_CONFIRMATION"
    : "PENDING_PAYMENT";
}

function isCustomerCancellableStatus(status: OrderEntity["status"]): boolean {
  return (
    status === "PENDING_PAYMENT" ||
    status === "PENDING_PAYMENT_VERIFICATION" ||
    status === "PENDING_CONFIRMATION" ||
    status === "PENDING"
  );
}
