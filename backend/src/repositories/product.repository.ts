export interface ProductSellerSummary {
  id: string;
  name: string;
}

export interface ProductCategorySummary {
  id: string;
  name: string;
}

export const MAX_PRODUCT_IMAGES = 8;

export interface ProductImageEntity {
  id: string;
  productId: string;
  imageUrl: string;
  isPrimary: boolean;
  createdAt: Date;
}

export interface ProductEntity {
  id: string;
  sellerId: string;
  categoryId: string;
  name: string;
  description: string;
  price: string;
  quantity: number;
  imageUrl: string | null;
  seller: ProductSellerSummary;
  category: ProductCategorySummary;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductDetailsEntity extends ProductEntity {
  averageRating: number | null;
  reviewCount: number;
}

export interface CreateProductInput {
  sellerId: string;
  categoryId: string;
  name: string;
  description: string;
  price: string;
  quantity: number;
  imageUrl?: string;
}

export interface UpdateProductInput {
  categoryId?: string;
  name?: string;
  description?: string;
  price?: string;
  quantity?: number;
  imageUrl?: string | null;
}

export type ProductDiscoveryStock = "in_stock" | "out_of_stock";

export type ProductDiscoverySortBy =
  | "newest"
  | "oldest"
  | "price"
  | "name"
  | "popularity";

export type ProductDiscoverySortOrder = "asc" | "desc";

export interface ProductDiscoveryQuery {
  page: number;
  limit: number;
  search?: string;
  categoryId?: string;
  sellerId?: string;
  minPrice?: string;
  maxPrice?: string;
  stock?: ProductDiscoveryStock;
  sortBy: ProductDiscoverySortBy;
  sortOrder: ProductDiscoverySortOrder;
}

export interface ProductDiscoveryResult {
  products: ProductEntity[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ProductRepository {
  create(input: CreateProductInput): Promise<ProductEntity>;
  findAll(query: ProductDiscoveryQuery): Promise<ProductDiscoveryResult>;
  findById(id: string): Promise<ProductEntity | null>;
  findDetailsById(id: string): Promise<ProductDetailsEntity | null>;
  update(id: string, input: UpdateProductInput): Promise<ProductEntity | null>;
  delete(id: string): Promise<boolean>;
  addImage(
    productId: string,
    imageUrl: string,
  ): Promise<ProductImageEntity | null>;
  findImages(productId: string): Promise<ProductImageEntity[]>;
  deleteImage(productId: string, imageId: string): Promise<boolean>;
  setPrimaryImage(
    productId: string,
    imageId: string,
  ): Promise<ProductImageEntity | null>;
}
