export interface CategoryEntity {
  id: string;
  name: string;
  description: string | null;
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string | null;
}

export interface CategoryRepository {
  create(input: CreateCategoryInput): Promise<CategoryEntity>;
  findAll(): Promise<CategoryEntity[]>;
  findById(id: string): Promise<CategoryEntity | null>;
  findByName(name: string): Promise<CategoryEntity | null>;
  update(
    id: string,
    input: UpdateCategoryInput,
  ): Promise<CategoryEntity | null>;
  delete(id: string): Promise<boolean>;
}
