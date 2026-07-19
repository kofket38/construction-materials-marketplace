import {
  CategoryInUseError,
  DuplicateCategoryNameError,
} from "../repositories/category.errors.js";
import type {
  CategoryEntity,
  CategoryRepository,
} from "../repositories/category.repository.js";
import type { AuthenticatedUser } from "../types/auth.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../utils/api-error.js";
import type {
  CreateCategoryBody,
  UpdateCategoryBody,
} from "../validators/category.validators.js";

export class CategoryService {
  constructor(private readonly categories: CategoryRepository) {}

  async create(
    actor: AuthenticatedUser,
    input: CreateCategoryBody,
  ): Promise<CategoryEntity> {
    this.requireAdmin(actor);
    await this.requireUniqueName(input.name);

    try {
      return await this.categories.create({
        name: input.name,
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
      });
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  findAll(): Promise<CategoryEntity[]> {
    return this.categories.findAll();
  }

  async findById(id: string): Promise<CategoryEntity> {
    const category = await this.categories.findById(id);
    if (!category) {
      throw new NotFoundError("Category not found.");
    }
    return category;
  }

  async update(
    id: string,
    actor: AuthenticatedUser,
    input: UpdateCategoryBody,
  ): Promise<CategoryEntity> {
    this.requireAdmin(actor);

    if (!(await this.categories.findById(id))) {
      throw new NotFoundError("Category not found.");
    }

    if (input.name !== undefined) {
      await this.requireUniqueName(input.name, id);
    }

    try {
      const category = await this.categories.update(id, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
      });

      if (!category) {
        throw new NotFoundError("Category not found.");
      }

      return category;
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  async delete(id: string, actor: AuthenticatedUser): Promise<void> {
    this.requireAdmin(actor);

    try {
      if (!(await this.categories.delete(id))) {
        throw new NotFoundError("Category not found.");
      }
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  private requireAdmin(actor: AuthenticatedUser): void {
    if (actor.role !== "ADMIN") {
      throw new ForbiddenError("Administrator access is required.");
    }
  }

  private async requireUniqueName(
    name: string,
    currentCategoryId?: string,
  ): Promise<void> {
    const existing = await this.categories.findByName(name);

    if (existing && existing.id !== currentCategoryId) {
      throw new ConflictError("A category with that name already exists.");
    }
  }

  private handleRepositoryError(error: unknown): never {
    if (error instanceof DuplicateCategoryNameError) {
      throw new ConflictError(error.message);
    }
    if (error instanceof CategoryInUseError) {
      throw new ConflictError(error.message);
    }

    throw error;
  }
}
