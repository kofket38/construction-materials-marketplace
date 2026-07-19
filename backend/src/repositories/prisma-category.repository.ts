import type {
  Category,
  PrismaClient,
} from "../prisma/generated/client.js";
import {
  CategoryInUseError,
  DuplicateCategoryNameError,
} from "./category.errors.js";
import type {
  CategoryEntity,
  CategoryRepository,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "./category.repository.js";

function mapCategory(category: Category): CategoryEntity {
  return {
    id: category.id,
    name: category.name,
    description: category.description,
  };
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

export class PrismaCategoryRepository implements CategoryRepository {
  constructor(private readonly client: PrismaClient) {}

  async create(input: CreateCategoryInput): Promise<CategoryEntity> {
    try {
      const category = await this.client.category.create({
        data: {
          name: input.name,
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
        },
      });

      return mapCategory(category);
    } catch (error) {
      if (hasPrismaCode(error, "P2002")) {
        throw new DuplicateCategoryNameError();
      }
      throw error;
    }
  }

  async findAll(): Promise<CategoryEntity[]> {
    const categories = await this.client.category.findMany({
      orderBy: { name: "asc" },
    });

    return categories.map(mapCategory);
  }

  async findById(id: string): Promise<CategoryEntity | null> {
    const category = await this.client.category.findUnique({ where: { id } });
    return category ? mapCategory(category) : null;
  }

  async findByName(name: string): Promise<CategoryEntity | null> {
    const category = await this.client.category.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    });

    return category ? mapCategory(category) : null;
  }

  async update(
    id: string,
    input: UpdateCategoryInput,
  ): Promise<CategoryEntity | null> {
    try {
      const category = await this.client.category.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
        },
      });

      return mapCategory(category);
    } catch (error) {
      if (hasPrismaCode(error, "P2025")) {
        return null;
      }
      if (hasPrismaCode(error, "P2002")) {
        throw new DuplicateCategoryNameError();
      }
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.client.category.delete({ where: { id } });
      return true;
    } catch (error) {
      if (hasPrismaCode(error, "P2025")) {
        return false;
      }
      if (hasPrismaCode(error, "P2003")) {
        throw new CategoryInUseError();
      }
      throw error;
    }
  }
}
