import { randomUUID } from "node:crypto";
import { ProductCategoryNotFoundError } from "../../src/repositories/product.errors.js";
import type {
  CreateProductInput,
  ProductDiscoveryQuery,
  ProductDiscoveryResult,
  ProductEntity,
  ProductRepository,
  UpdateProductInput,
} from "../../src/repositories/product.repository.js";

interface CategorySeed {
  id: string;
  name: string;
}

export class InMemoryProductRepository implements ProductRepository {
  private readonly products = new Map<string, ProductEntity>();
  private readonly categories = new Map<string, CategorySeed>();
  private readonly sellerNames = new Map<string, string>();
  private readonly sellerShopNames = new Map<string, string>();
  private readonly popularity = new Map<string, number>();

  addCategory(category: CategorySeed): void {
    this.categories.set(category.id, category);
  }

  addSeller(id: string, name: string, shopName?: string): void {
    this.sellerNames.set(id, name);
    if (shopName !== undefined) {
      this.sellerShopNames.set(id, shopName);
    }
  }

  async create(input: CreateProductInput): Promise<ProductEntity> {
    const category = this.requireCategory(input.categoryId);
    const now = new Date();
    const product: ProductEntity = {
      id: randomUUID(),
      sellerId: input.sellerId,
      categoryId: input.categoryId,
      name: input.name,
      description: input.description,
      price: Number(input.price).toFixed(2),
      quantity: input.quantity,
      imageUrl: input.imageUrl ?? null,
      seller: {
        id: input.sellerId,
        name: this.sellerNames.get(input.sellerId) ?? "Test Seller",
      },
      category: { ...category },
      createdAt: now,
      updatedAt: now,
    };

    this.products.set(product.id, product);
    this.popularity.set(product.id, 0);
    return product;
  }

  async findAll(
    query: ProductDiscoveryQuery,
  ): Promise<ProductDiscoveryResult> {
    const search = query.search?.toLocaleLowerCase();
    const products = [...this.products.values()]
      .filter(
        (product) =>
          search === undefined ||
          product.name.toLocaleLowerCase().includes(search) ||
          product.description.toLocaleLowerCase().includes(search) ||
          (this.sellerShopNames.get(product.sellerId) ?? "")
            .toLocaleLowerCase()
            .includes(search),
      )
      .filter(
        (product) =>
          query.categoryId === undefined ||
          product.categoryId === query.categoryId,
      )
      .filter(
        (product) =>
          query.sellerId === undefined ||
          product.sellerId === query.sellerId,
      )
      .filter(
        (product) =>
          query.minPrice === undefined ||
          Number(product.price) >= Number(query.minPrice),
      )
      .filter(
        (product) =>
          query.maxPrice === undefined ||
          Number(product.price) <= Number(query.maxPrice),
      )
      .filter(
        (product) =>
          query.stock === undefined ||
          (query.stock === "in_stock"
            ? product.quantity > 0
            : product.quantity === 0),
      )
      .sort((left, right) => this.compareProducts(left, right, query));
    const totalItems = products.length;
    const totalPages = Math.ceil(totalItems / query.limit);

    return {
      products: products.slice(
        (query.page - 1) * query.limit,
        query.page * query.limit,
      ),
      totalItems,
      totalPages,
      currentPage: query.page,
      pageSize: query.limit,
      hasNextPage: query.page < totalPages,
      hasPreviousPage: query.page > 1,
    };
  }

  async findById(id: string): Promise<ProductEntity | null> {
    return this.products.get(id) ?? null;
  }

  async update(
    id: string,
    input: UpdateProductInput,
  ): Promise<ProductEntity | null> {
    const product = this.products.get(id);
    if (!product) {
      return null;
    }

    if (input.categoryId !== undefined) {
      const category = this.requireCategory(input.categoryId);
      product.categoryId = input.categoryId;
      product.category = { ...category };
    }
    if (input.name !== undefined) product.name = input.name;
    if (input.description !== undefined) {
      product.description = input.description;
    }
    if (input.price !== undefined) {
      product.price = Number(input.price).toFixed(2);
    }
    if (input.quantity !== undefined) product.quantity = input.quantity;
    if (input.imageUrl !== undefined) product.imageUrl = input.imageUrl;
    product.updatedAt = new Date();

    return product;
  }

  async delete(id: string): Promise<boolean> {
    this.popularity.delete(id);
    return this.products.delete(id);
  }

  setCreatedAt(id: string, createdAt: Date): void {
    const product = this.products.get(id);
    if (!product) {
      throw new Error(`Test product ${id} was not found.`);
    }
    product.createdAt = createdAt;
  }

  setPopularity(id: string, orderCount: number): void {
    if (!this.products.has(id)) {
      throw new Error(`Test product ${id} was not found.`);
    }
    this.popularity.set(id, orderCount);
  }

  private requireCategory(categoryId: string): CategorySeed {
    const category = this.categories.get(categoryId);
    if (!category) {
      throw new ProductCategoryNotFoundError();
    }
    return category;
  }

  private compareProducts(
    left: ProductEntity,
    right: ProductEntity,
    query: ProductDiscoveryQuery,
  ): number {
    let comparison: number;

    switch (query.sortBy) {
      case "newest":
        comparison =
          right.createdAt.getTime() - left.createdAt.getTime();
        break;
      case "oldest":
        comparison =
          left.createdAt.getTime() - right.createdAt.getTime();
        break;
      case "price":
        comparison = Number(left.price) - Number(right.price);
        if (query.sortOrder === "desc") comparison *= -1;
        break;
      case "name":
        comparison = left.name.localeCompare(right.name);
        if (query.sortOrder === "desc") comparison *= -1;
        break;
      case "popularity":
        comparison =
          (this.popularity.get(left.id) ?? 0) -
          (this.popularity.get(right.id) ?? 0);
        if (query.sortOrder === "desc") comparison *= -1;
        if (comparison === 0) {
          comparison =
            right.createdAt.getTime() - left.createdAt.getTime();
        }
        break;
    }

    return comparison || left.id.localeCompare(right.id);
  }
}
