import {
  DuplicateWishlistItemError,
  WishlistProductNotFoundError,
} from "../repositories/wishlist.errors.js";
import type {
  WishlistItemEntity,
  WishlistRepository,
} from "../repositories/wishlist.repository.js";
import type { AuthenticatedUser } from "../types/auth.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../utils/api-error.js";

export class WishlistService {
  constructor(private readonly wishlist: WishlistRepository) {}

  async create(
    productId: string,
    actor: AuthenticatedUser,
  ): Promise<WishlistItemEntity> {
    this.requireCustomer(actor);

    try {
      return await this.wishlist.create({
        customerId: actor.userId,
        productId,
      });
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  findAll(actor: AuthenticatedUser): Promise<WishlistItemEntity[]> {
    this.requireCustomer(actor);
    return this.wishlist.findByCustomerId(actor.userId);
  }

  async delete(
    productId: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    this.requireCustomer(actor);

    if (!(await this.wishlist.delete(actor.userId, productId))) {
      throw new NotFoundError("Wishlist item not found.");
    }
  }

  private requireCustomer(actor: AuthenticatedUser): void {
    // PROFESSIONAL accounts are buyer-capable and share customer purchasing.
    if (actor.role !== "CUSTOMER" && actor.role !== "PROFESSIONAL") {
      throw new ForbiddenError("Customer access is required.");
    }
  }

  private handleRepositoryError(error: unknown): never {
    if (error instanceof DuplicateWishlistItemError) {
      throw new ConflictError(error.message);
    }
    if (error instanceof WishlistProductNotFoundError) {
      throw new NotFoundError(error.message);
    }

    throw error;
  }
}
