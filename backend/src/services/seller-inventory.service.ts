import {
  SellerInventoryDuplicateError,
  SellerInventoryNotFoundError,
  SellerInventoryProductNotFoundError,
  SellerInventoryProductNotOwnedError,
} from "../repositories/seller-inventory.errors.js";
import type {
  SellerInventoryEntity,
  SellerInventoryListResult,
  SellerInventoryRepository,
} from "../repositories/seller-inventory.repository.js";
import type { AuthenticatedUser } from "../types/auth.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../utils/api-error.js";
import type {
  CreateSellerInventoryBody,
  ListSellerInventoryQuery,
  UpdateSellerInventoryBody,
} from "../validators/seller-inventory.validators.js";

export class SellerInventoryService {
  constructor(
    private readonly inventory: SellerInventoryRepository,
  ) {}

  async list(
    actor: AuthenticatedUser,
    input: ListSellerInventoryQuery,
  ): Promise<SellerInventoryListResult> {
    this.requireSeller(actor);

    return this.inventory.list({
      sellerId: actor.userId,
      page: Number(input.page ?? "1"),
      limit: Number(input.limit ?? "20"),
      ...(input.search !== undefined ? { search: input.search } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
    });
  }

  async create(
    actor: AuthenticatedUser,
    input: CreateSellerInventoryBody,
  ): Promise<SellerInventoryEntity> {
    this.requireSeller(actor);

    try {
      return await this.inventory.create({
        sellerId: actor.userId,
        productId: input.productId,
        city: input.city,
        ...(input.region !== undefined ? { region: input.region } : {}),
        price: input.price,
        quantity: input.quantity,
        deliveryAvailable: input.deliveryAvailable,
      });
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  async update(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateSellerInventoryBody,
  ): Promise<SellerInventoryEntity> {
    this.requireSeller(actor);
    await this.requireOwnInventory(actor.userId, id);

    try {
      const updated = await this.inventory.update(id, {
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.region !== undefined ? { region: input.region } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
        ...(input.deliveryAvailable !== undefined
          ? { deliveryAvailable: input.deliveryAvailable }
          : {}),
      });

      if (!updated) {
        throw new NotFoundError("Inventory entry not found.");
      }

      return updated;
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  async remove(actor: AuthenticatedUser, id: string): Promise<void> {
    this.requireSeller(actor);
    await this.requireOwnInventory(actor.userId, id);
    await this.inventory.delete(id);
  }

  private requireSeller(actor: AuthenticatedUser): void {
    if (actor.role !== "SELLER") {
      throw new ForbiddenError("Seller access is required.");
    }
  }

  /**
   * Load the inventory entry and verify it belongs to this seller.
   * Throws NotFoundError (404) for both missing and foreign-seller entries
   * so callers cannot enumerate other sellers' inventory by probing IDs.
   */
  private async requireOwnInventory(
    sellerId: string,
    id: string,
  ): Promise<SellerInventoryEntity> {
    const entry = await this.inventory.findById(id);

    if (!entry || entry.sellerId !== sellerId) {
      throw new NotFoundError("Inventory entry not found.");
    }

    return entry;
  }

  private handleRepositoryError(error: unknown): never {
    if (error instanceof SellerInventoryProductNotFoundError) {
      throw new NotFoundError(error.message);
    }
    if (error instanceof SellerInventoryProductNotOwnedError) {
      throw new ForbiddenError(error.message);
    }
    if (error instanceof SellerInventoryDuplicateError) {
      throw new ConflictError(error.message);
    }
    if (error instanceof SellerInventoryNotFoundError) {
      throw new NotFoundError(error.message);
    }
    throw error;
  }
}
