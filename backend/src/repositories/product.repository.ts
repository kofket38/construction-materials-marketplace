export interface ProductSellerSummary {
  id: string;
  name: string;
  address?: string | null;
  averageRating?: number | null;
  city?: string | null;
  email?: string | null;
  phone?: string | null;
  reviewCount?: number;
  shopName?: string | null;
}

export interface ProductCategorySummary {
  id: string;
  name: string;
}

export interface ProductBrandSummary {
  id: string;
  name: string;
}

export interface ProductInventorySummary {
  city: string;
  deliveryAvailable: boolean;
  price: string;
  quantity: number;
  region: string | null;
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
  /** Legacy catalog price. When a city filter is active, use inventoryPrice. */
  price: string;
  /** Legacy catalog quantity. When a city filter is active, use inventoryQuantity. */
  quantity: number;
  imageUrl: string | null;
  averageRating?: number | null;
  reviewCount?: number;
  /**
   * City-specific price from SellerInventory.
   * Present when the product was fetched with a city filter
   * or through a seller store page with a city context.
   */
  inventoryPrice?: string | null;
  /**
   * City-specific stock from SellerInventory.
   * Present when the product was fetched with a city filter
   * or through a seller store page with a city context.
   */
  inventoryQuantity?: number | null;
  /**
   * The city for which inventoryPrice and inventoryQuantity are valid.
   */
  inventoryCity?: string | null;
  seller: ProductSellerSummary;
  category: ProductCategorySummary;
  brand?: ProductBrandSummary | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductDetailsEntity extends ProductEntity {
  averageRating: number | null;
  deliveryAvailable?: boolean;
  inventory?: ProductInventorySummary[];
  location?: string | null;
  minimumOrder?: string | null;
  origin?: string | null;
  packaging?: string | null;
  reviewCount: number;
  specifications?: Record<string, string>;
  strengthGrade?: string | null;
  weight?: string | null;
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
  city?: string;
  categoryId?: string;
  sellerId?: string;
  minPrice?: string;
  maxPrice?: string;
  stock?: ProductDiscoveryStock;
  sortBy: ProductDiscoverySortBy;
  sortOrder: ProductDiscoverySortOrder;
}

export interface MarketplaceCityEntity {
  name: string;
  productCount: number;
  sellerCount: number;
}

export interface MarketplaceSellerEntity {
  id: string;
  name: string;
  shopName: string | null;
  city: string;
  productCount: number;
  averageRating: number | null;
  reviewCount: number;
}

export interface SellerStoreEntity {
  id: string;
  name: string;
  storeName: string;
  logoUrl: string | null;
  city: string | null;
  cities: string[];
  address: string | null;
  phone: string | null;
  email: string;
  averageRating: number | null;
  reviewCount: number;
  totalProducts: number;
  joinedAt: Date;
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
  findMarketplaceCities(): Promise<MarketplaceCityEntity[]>;
  findMarketplaceSellers(city: string): Promise<MarketplaceSellerEntity[]>;
  findSellerStore(
    sellerId: string,
    city?: string,
  ): Promise<SellerStoreEntity | null>;
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
