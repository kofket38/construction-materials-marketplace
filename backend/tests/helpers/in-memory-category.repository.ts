import { randomUUID } from "node:crypto";
import {
  CategoryInUseError,
  DuplicateCategoryNameError,
} from "../../src/repositories/category.errors.js";
import type {
  CategoryEntity,
  CategoryRepository,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "../../src/repositories/category.repository.js";

export class InMemoryCategoryRepository implements CategoryRepository {
  private readonly categories = new Map<string, CategoryEntity>();
  private readonly categoriesInUse = new Set<string>();

  async create(input: CreateCategoryInput): Promise<CategoryEntity> {
    if (await this.findByName(input.name)) {
      throw new DuplicateCategoryNameError();
    }

    const category: CategoryEntity = {
      id: randomUUID(),
      name: input.name,
      description: input.description ?? null,
    };

    this.categories.set(category.id, category);
    return category;
  }

  async findAll(): Promise<CategoryEntity[]> {
    return [...this.categories.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }

  async findById(id: string): Promise<CategoryEntity | null> {
    return this.categories.get(id) ?? null;
  }

  async findByName(name: string): Promise<CategoryEntity | null> {
    const normalizedName = name.toLocaleLowerCase();
    return (
      [...this.categories.values()].find(
        (category) => category.name.toLocaleLowerCase() === normalizedName,
      ) ?? null
    );
  }

  async update(
    id: string,
    input: UpdateCategoryInput,
  ): Promise<CategoryEntity | null> {
    const category = this.categories.get(id);
    if (!category) {
      return null;
    }

    if (input.name !== undefined) {
      const duplicate = await this.findByName(input.name);
      if (duplicate && duplicate.id !== id) {
        throw new DuplicateCategoryNameError();
      }
      category.name = input.name;
    }
    if (input.description !== undefined) {
      category.description = input.description;
    }

    return category;
  }

  async delete(id: string): Promise<boolean> {
    if (this.categoriesInUse.has(id)) {
      throw new CategoryInUseError();
    }
    return this.categories.delete(id);
  }

  markInUse(id: string): void {
    this.categoriesInUse.add(id);
  }
}
