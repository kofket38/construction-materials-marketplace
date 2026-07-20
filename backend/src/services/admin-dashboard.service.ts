import { AdminProductInUseError } from "../repositories/admin-dashboard.errors.js";
import type {
  AdminDashboardRepository,
  AdminDashboardSummary,
  AdminProductsResult,
  AdminSellersResult,
  AdminUserEntity,
  AdminUsersResult,
} from "../repositories/admin-dashboard.repository.js";
import type { AuthenticatedUser } from "../types/auth.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../utils/api-error.js";
import type {
  AdminProductsQueryParams,
  AdminSellersQueryParams,
  AdminUsersQueryParams,
  UpdateAdminUserStatusBody,
} from "../validators/admin-dashboard.validators.js";

export class AdminDashboardService {
  constructor(private readonly admin: AdminDashboardRepository) {}

  getDashboard(actor: AuthenticatedUser): Promise<AdminDashboardSummary> {
    this.requireAdmin(actor);
    const now = new Date();

    return this.admin.getDashboard({
      monthStart: startOfUtcMonth(now),
      nextMonthStart: startOfNextUtcMonth(now),
    });
  }

  findUsers(
    actor: AuthenticatedUser,
    input: AdminUsersQueryParams,
  ): Promise<AdminUsersResult> {
    this.requireAdmin(actor);

    return this.admin.findUsers({
      page: Number(input.page ?? "1"),
      limit: Number(input.limit ?? "20"),
      ...(input.search !== undefined
        ? { search: input.search.trim() }
        : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
    });
  }

  async updateUserStatus(
    id: string,
    actor: AuthenticatedUser,
    input: UpdateAdminUserStatusBody,
  ): Promise<AdminUserEntity> {
    this.requireAdmin(actor);
    const isActive = input.status === "ACTIVE";

    if (id === actor.userId && !isActive) {
      throw new ForbiddenError(
        "Administrators cannot disable their own account.",
      );
    }

    const user = await this.admin.updateUserStatus(id, isActive);
    if (!user) {
      throw new NotFoundError("User not found.");
    }

    return user;
  }

  findSellers(
    actor: AuthenticatedUser,
    input: AdminSellersQueryParams,
  ): Promise<AdminSellersResult> {
    this.requireAdmin(actor);

    return this.admin.findSellers({
      page: Number(input.page ?? "1"),
      limit: Number(input.limit ?? "20"),
      ...(input.search !== undefined
        ? { search: input.search.trim() }
        : {}),
    });
  }

  findProducts(
    actor: AuthenticatedUser,
    input: AdminProductsQueryParams,
  ): Promise<AdminProductsResult> {
    this.requireAdmin(actor);

    return this.admin.findProducts({
      page: Number(input.page ?? "1"),
      limit: Number(input.limit ?? "20"),
      ...(input.search !== undefined
        ? { search: input.search.trim() }
        : {}),
      ...(input.categoryId !== undefined
        ? { categoryId: input.categoryId }
        : {}),
      ...(input.sellerId !== undefined ? { sellerId: input.sellerId } : {}),
    });
  }

  async deleteProduct(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    this.requireAdmin(actor);

    try {
      if (!(await this.admin.deleteProduct(id))) {
        throw new NotFoundError("Product not found.");
      }
    } catch (error) {
      if (error instanceof AdminProductInUseError) {
        throw new ConflictError(error.message);
      }
      throw error;
    }
  }

  private requireAdmin(actor: AuthenticatedUser): void {
    if (actor.role !== "ADMIN") {
      throw new ForbiddenError("Administrator access is required.");
    }
  }
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfNextUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}
