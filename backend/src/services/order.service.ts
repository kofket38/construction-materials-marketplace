import {
  InsufficientProductStockError,
  OrderAlreadyCancelledError,
  OrderCustomerNotFoundError,
  OrderNotPendingError,
  OrderProductNotFoundError,
  OrderSerializationError,
  OrderStateChangedError,
  OrderTerminalStatusError,
  OwnProductOrderError,
  SellerInventoryNotFoundError,
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
import type { ProcurementProjectLinker } from "./procurement-project.port.js";
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
    private readonly projectLinker: ProcurementProjectLinker,
  ) {}

  async create(
    actor: AuthenticatedUser,
    input: CreateOrderBody,
  ): Promise<CreateOrderResult> {
    this.requireCustomer(actor);
    // Resolved before the repository transaction opens so an invalid project
    // never costs a stock-reserving write attempt.
    const projectId = await this.projectLinker.resolveProcurementProject(
      actor,
      input.projectId,
    );
    const paymentDestination = isManualPaymentMethod(input.paymentMethod)
      ? await this.requirePaymentDestination(
          input.items.map((item) => item.productId),
          input.paymentMethod,
        )
      : null;

    try {
      const order = await this.orders.create({
        customerId: actor.userId,
        projectId,
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

    // Fetch current state to enforce the admin transition policy.
    const current = await this.requireOrder(id);
    const allowed = allowedAdminTransitions(current.status);

    if (!allowed.includes(input.status)) {
      throw new ConflictError(
        allowed.length > 0
          ? `Cannot transition from ${current.status} to ${input.status}. Allowed: ${allowed.join(", ")}.`
          : `Order is in a terminal state (${current.status}) and cannot be updated.`,
      );
    }

    try {
      const order =
        input.status === "CANCELLED"
          ? await this.orders.cancel(id, { onlyIfPending: false })
          : input.status === "PAYMENT_REJECTED"
            ? await this.orders.rejectPayment(id)
            : await this.orders.updateStatus(id, input.status);

      if (!order) {
        throw new NotFoundError("Order not found.");
      }

      return order;
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  async complete(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<OrderEntity> {
    this.requireCustomer(actor);
    const order = await this.requireOrder(id);

    if (order.customerId !== actor.userId) {
      throw new ForbiddenError("You can only complete your own orders.");
    }
    if (order.status === "COMPLETED") {
      return order;
    }
    if (order.status !== "DELIVERED") {
      throw new ConflictError(
        "Only delivered orders can be marked completed.",
      );
    }

    try {
      const completed = await this.orders.complete(id, actor.userId);
      if (!completed) {
        throw new NotFoundError("Order not found.");
      }
      return completed;
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
    // PROFESSIONAL accounts are buyer-capable and share customer purchasing.
    if (actor.role !== "CUSTOMER" && actor.role !== "PROFESSIONAL") {
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
    if (error instanceof SellerInventoryNotFoundError) {
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
    // P2034 serialization failure: two concurrent orders competed for the
    // same inventory. Surface as 409 so the client can safely retry.
    if (error instanceof OrderSerializationError) {
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

/**
 * Returns the set of statuses an ADMIN may transition to from the given
 * current status.
 *
 * Policy:
 * - COMPLETED and CANCELLED are terminal — no further transitions.
 * - DELIVERED may only be cancelled (no inventory restoration applies —
 *   the repository's cancel() skips restoration for DELIVERED orders).
 * - All other statuses allow forward progression according to the
 *   marketplace workflow plus admin-only emergency cancellation.
 * - Retrograde transitions (e.g. DELIVERED → CONFIRMED) are never allowed.
 *
 * This mirrors the seller's nextOrderStatuses() but is kept separate because
 * admin and seller have different sets of meaningful actions.
 */
function allowedAdminTransitions(
  status: OrderEntity["status"],
): OrderEntity["status"][] {
  switch (status) {
    // ── Terminal states ────────────────────────────────────────────────────
    case "COMPLETED":
    case "CANCELLED":
      return [];

    // ── DELIVERED: admin may only cancel (no inventory restoration) ────────
    case "DELIVERED":
      return ["CANCELLED"];

    // ── Payment-pending states ─────────────────────────────────────────────
    case "PENDING_PAYMENT":
      return ["PENDING_PAYMENT_VERIFICATION", "CANCELLED"];

    case "PENDING_PAYMENT_VERIFICATION":
      return ["CONFIRMED", "PAYMENT_REJECTED", "CANCELLED"];

    case "PAYMENT_REJECTED":
      return ["CANCELLED"];

    // ── Confirmation-pending states ────────────────────────────────────────
    case "PENDING_CONFIRMATION":
    case "PENDING":
    case "PAYMENT_VERIFIED":
      return ["CONFIRMED", "CANCELLED"];

    // ── Fulfilment states ──────────────────────────────────────────────────
    case "CONFIRMED":
      return ["PROCESSING", "CANCELLED"];

    case "PROCESSING":
      return ["READY_FOR_DELIVERY", "CANCELLED"];

    case "READY_FOR_DELIVERY":
      return ["SHIPPED", "CANCELLED"];

    case "OUT_FOR_DELIVERY":
    case "SHIPPED":
      return ["DELIVERED", "CANCELLED"];

    // ── Rejected/legacy states ─────────────────────────────────────────────
    case "REJECTED":
      return ["CANCELLED"];

    default:
      return [];
  }
}
