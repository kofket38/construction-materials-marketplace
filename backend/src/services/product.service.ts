import type {
  ProductDiscoveryResult,
  ProductDiscoverySortBy,
  ProductEntity,
  ProductRepository,
} from "../repositories/product.repository.js";
import {
  ProductCategoryNotFoundError,
  ProductInUseError,
  ProductSellerNotFoundError,
} from "../repositories/product.errors.js";
import type { AuthenticatedUser } from "../types/auth.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../utils/api-error.js";
import type {
  CreateProductBody,
  ProductDiscoveryQueryParams,
  UpdateProductBody,
} from "../validators/product.validators.js";

export class ProductService {
  constructor(private readonly products: ProductRepository) {}

  async create(
    actor: AuthenticatedUser,
    input: CreateProductBody,
  ): Promise<ProductEntity> {
    this.requireSeller(actor);

    try {
      return await this.products.create({
        sellerId: actor.userId,
        categoryId: input.categoryId,
        name: input.name,
        description: input.description,
        price: input.price,
        quantity: input.quantity,
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      });
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  findAll(
    input: ProductDiscoveryQueryParams,
  ): Promise<ProductDiscoveryResult> {
    const sortBy = input.sortBy ?? "newest";

    return this.products.findAll({
      page: Number(input.page ?? "1"),
      limit: Number(input.limit ?? "20"),
      sortBy,
      sortOrder: input.sortOrder ?? defaultSortOrder(sortBy),
      ...(input.search !== undefined
        ? { search: input.search.trim() }
        : {}),
      ...(input.categoryId !== undefined
        ? { categoryId: input.categoryId }
        : {}),
      ...(input.sellerId !== undefined ? { sellerId: input.sellerId } : {}),
      ...(input.minPrice !== undefined
        ? { minPrice: normalizePrice(input.minPrice) }
        : {}),
      ...(input.maxPrice !== undefined
        ? { maxPrice: normalizePrice(input.maxPrice) }
        : {}),
      ...(input.stock !== undefined ? { stock: input.stock } : {}),
    });
  }

  async findById(id: string): Promise<ProductEntity> {
    const product = await this.products.findById(id);

    if (!product) {
      throw new NotFoundError("Product not found.");
    }

    return product;
  }

  async update(
    id: string,
    actor: AuthenticatedUser,
    input: UpdateProductBody,
  ): Promise<ProductEntity> {
    this.requireSeller(actor);
    await this.requireOwner(id, actor.userId, "update");

    try {
      const product = await this.products.update(id, {
        ...(input.categoryId !== undefined
          ? { categoryId: input.categoryId }
          : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.quantity !== undefined
          ? { quantity: input.quantity }
          : {}),
        ...(input.imageUrl !== undefined
          ? { imageUrl: input.imageUrl }
          : {}),
      });

      if (!product) {
        throw new NotFoundError("Product not found.");
      }

      return product;
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  async delete(id: string, actor: AuthenticatedUser): Promise<void> {
    this.requireSeller(actor);
    await this.requireOwner(id, actor.userId, "delete");

    try {
      if (!(await this.products.delete(id))) {
        throw new NotFoundError("Product not found.");
      }
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  private requireSeller(actor: AuthenticatedUser): void {
    if (actor.role !== "SELLER") {
      throw new ForbiddenError("Seller access is required.");
    }
  }

  private async requireOwner(
    productId: string,
    userId: string,
    action: "update" | "delete",
  ): Promise<void> {
    const product = await this.products.findById(productId);

    if (!product) {
      throw new NotFoundError("Product not found.");
    }

    if (product.sellerId !== userId) {
      throw new ForbiddenError(
        `You can only ${action} products that you own.`,
      );
    }
  }

  private handleRepositoryError(error: unknown): never {
    if (error instanceof ProductCategoryNotFoundError) {
      throw new NotFoundError(error.message);
    }
    if (error instanceof ProductSellerNotFoundError) {
      throw new UnauthorizedError(error.message);
    }
    if (error instanceof ProductInUseError) {
      throw new ConflictError(error.message);
    }

    throw error;
  }
}

function defaultSortOrder(
  sortBy: ProductDiscoverySortBy,
): "asc" | "desc" {
  return sortBy === "newest" || sortBy === "popularity" ? "desc" : "asc";
}

function normalizePrice(value: string): string {
  return Number(value).toFixed(2);
}
