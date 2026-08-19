import type {
  SellerAnalytics,
  SellerDashboardRepository,
  SellerDashboardSummary,
  SellerOrderEntity,
  SellerPaymentDecision,
  SellerOrderQuery,
  SellerOrdersResult,
  SellerProductQuery,
  SellerProductsResult,
} from "../repositories/seller-dashboard.repository.js";
import { SellerOrderStateChangedError } from "../repositories/seller-dashboard.errors.js";
import {
  InsufficientProductStockError,
  OrderProductNotFoundError,
} from "../repositories/order.errors.js";
import type { OrderStatus } from "../repositories/order.repository.js";
import type { AuthenticatedUser } from "../types/auth.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../utils/api-error.js";
import type {
  SellerOrdersQueryParams,
  SellerProductsQueryParams,
} from "../validators/seller-dashboard.validators.js";

export class SellerDashboardService {
  constructor(private readonly dashboard: SellerDashboardRepository) {}

  getDashboard(actor: AuthenticatedUser): Promise<SellerDashboardSummary> {
    this.requireSeller(actor);
    const now = new Date();

    return this.dashboard.getDashboard(actor.userId, {
      monthStart: startOfUtcMonth(now),
      nextMonthStart: startOfNextUtcMonth(now),
    });
  }

  findProducts(
    actor: AuthenticatedUser,
    input: SellerProductsQueryParams,
  ): Promise<SellerProductsResult> {
    this.requireSeller(actor);

    const query: SellerProductQuery = {
      page: Number(input.page ?? "1"),
      limit: Number(input.limit ?? "20"),
      sortBy: input.sortBy ?? "createdAt",
      sortOrder: input.sortOrder ?? "desc",
      ...(input.search !== undefined
        ? { search: input.search.trim() }
        : {}),
      ...(input.categoryId !== undefined
        ? { categoryId: input.categoryId }
        : {}),
      ...(input.stock !== undefined ? { stock: input.stock } : {}),
    };

    return this.dashboard.findProducts(actor.userId, query);
  }

  findOrders(
    actor: AuthenticatedUser,
    input: SellerOrdersQueryParams,
  ): Promise<SellerOrdersResult> {
    this.requireSeller(actor);

    const query: SellerOrderQuery = {
      page: Number(input.page ?? "1"),
      limit: Number(input.limit ?? "20"),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.dateFrom !== undefined
        ? { dateFrom: parseUtcDate(input.dateFrom) }
        : {}),
      ...(input.dateTo !== undefined
        ? { dateToExclusive: dayAfter(parseUtcDate(input.dateTo)) }
        : {}),
      ...(input.customerSearch !== undefined
        ? { customerSearch: input.customerSearch.trim() }
        : {}),
    };

    return this.dashboard.findOrders(actor.userId, query);
  }

  getAnalytics(actor: AuthenticatedUser): Promise<SellerAnalytics> {
    this.requireSeller(actor);
    const now = new Date();
    const currentMonthStart = startOfUtcMonth(now);

    return this.dashboard.getAnalytics(actor.userId, {
      startDate: shiftUtcMonths(currentMonthStart, -11),
      endDate: startOfNextUtcMonth(now),
    });
  }

  async findOrderById(
    actor: AuthenticatedUser,
    orderId: string,
  ): Promise<SellerOrderEntity> {
    this.requireSeller(actor);
    return this.requireOrder(actor.userId, orderId);
  }

  async verifyPayment(
    actor: AuthenticatedUser,
    orderId: string,
    decision: SellerPaymentDecision,
  ): Promise<SellerOrderEntity> {
    this.requireSeller(actor);
    const order = await this.requireOrder(actor.userId, orderId);

    if (
      order.status !== "PENDING_PAYMENT_VERIFICATION" ||
      order.payment?.status !== "PENDING_VERIFICATION"
    ) {
      throw new ConflictError(
        "This order is not awaiting payment verification.",
      );
    }

    try {
      const updated = await this.dashboard.verifyPayment(
        actor.userId,
        orderId,
        decision,
      );
      if (!updated) {
        throw new NotFoundError("Order not found.");
      }
      return updated;
    } catch (error) {
      this.handleStateChange(error);
    }
  }

  async updateOrderStatus(
    actor: AuthenticatedUser,
    orderId: string,
    status: OrderStatus,
  ): Promise<SellerOrderEntity> {
    this.requireSeller(actor);
    const order = await this.requireOrder(actor.userId, orderId);
    const expectedStatuses = nextOrderStatuses(order.status);

    if (!expectedStatuses.includes(status)) {
      throw new ConflictError(
        expectedStatuses.length > 0
          ? `The next order status must be ${expectedStatuses.join(" or ")}.`
          : "This order cannot be advanced further.",
      );
    }

    try {
      const updated = await this.dashboard.updateOrderStatus(
        actor.userId,
        orderId,
        order.status,
        status,
      );
      if (!updated) {
        throw new NotFoundError("Order not found.");
      }
      return updated;
    } catch (error) {
      this.handleStateChange(error);
    }
  }

  private requireSeller(actor: AuthenticatedUser): void {
    if (actor.role !== "SELLER") {
      throw new ForbiddenError("Seller access is required.");
    }
  }

  private async requireOrder(
    sellerId: string,
    orderId: string,
  ): Promise<SellerOrderEntity> {
    const order = await this.dashboard.findOrderById(sellerId, orderId);
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    return order;
  }

  private handleStateChange(error: unknown): never {
    if (error instanceof SellerOrderStateChangedError) {
      throw new ConflictError(error.message);
    }
    if (error instanceof InsufficientProductStockError) {
      throw new ConflictError(error.message);
    }
    if (error instanceof OrderProductNotFoundError) {
      throw new NotFoundError(error.message);
    }
    throw error;
  }
}

function nextOrderStatuses(status: OrderStatus): OrderStatus[] {
  switch (status) {
    case "PENDING_PAYMENT":
      return ["CANCELLED"];
    case "PENDING_PAYMENT_VERIFICATION":
      return [];
    case "PENDING_CONFIRMATION":
    case "PENDING":
    case "PAYMENT_VERIFIED":
      return ["CONFIRMED", "CANCELLED"];
    case "CONFIRMED":
      return ["PROCESSING", "CANCELLED"];
    case "PROCESSING":
      return ["READY_FOR_DELIVERY", "CANCELLED"];
    case "READY_FOR_DELIVERY":
      return ["SHIPPED", "CANCELLED"];
    case "SHIPPED":
    case "OUT_FOR_DELIVERY":
      return ["DELIVERED"];
    default:
      return [];
  }
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfNextUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function shiftUtcMonths(date: Date, months: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
}

function parseUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dayAfter(date: Date): Date {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}
