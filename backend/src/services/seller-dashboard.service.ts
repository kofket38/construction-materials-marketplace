import type {
  SellerAnalytics,
  SellerDashboardRepository,
  SellerDashboardSummary,
  SellerOrderQuery,
  SellerOrdersResult,
  SellerProductQuery,
  SellerProductsResult,
} from "../repositories/seller-dashboard.repository.js";
import type { AuthenticatedUser } from "../types/auth.js";
import { ForbiddenError } from "../utils/api-error.js";
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

  private requireSeller(actor: AuthenticatedUser): void {
    if (actor.role !== "SELLER") {
      throw new ForbiddenError("Seller access is required.");
    }
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
