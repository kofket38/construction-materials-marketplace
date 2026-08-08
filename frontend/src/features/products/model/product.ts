export interface ProductSeller {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  location?: string | null;
  region?: string | null;
  shopName?: string | null;
  averageRating?: number | null;
  reviewCount?: number;
}

export interface ProductCategory {
  id: string;
  name: string;
}

export interface ProductBrand {
  id?: string;
  name: string;
}

export interface ProductInventory {
  city: string;
  deliveryAvailable: boolean;
  price?: string;
  quantity?: number;
  region?: string | null;
}

export interface Product {
  id: string;
  sellerId: string;
  categoryId: string;
  brand?: ProductBrand | null;
  name: string;
  description: string;
  price: string;
  quantity: number;
  imageUrl: string | null;
  averageRating?: number | null;
  reviewCount?: number;
  sku?: string | null;
  seller: ProductSeller;
  category: ProductCategory;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDetails extends Product {
  averageRating: number | null;
  deliveryAvailable?: boolean | null;
  deliveryStatus?: string | null;
  inventory?: ProductInventory[];
  location?: string | null;
  minimumOrder?: number | string | null;
  origin?: string | null;
  packaging?: string | null;
  reviewCount: number;
  specifications?: Record<string, boolean | number | string | null>;
  strengthGrade?: string | null;
  weight?: string | null;
}

export interface ProductReviewCustomer {
  id: string;
  name: string;
}

export interface ProductReview {
  id: string;
  productId: string;
  customerId: string;
  rating: number;
  comment: string | null;
  customer: ProductReviewCustomer;
  createdAt: string;
  updatedAt: string;
}

export interface ProductReviewResult {
  reviews: ProductReview[];
  averageRating: number | null;
  reviewCount: number;
}

export type ProductStockFilter = "in_stock" | "out_of_stock";

export type ProductSortBy =
  | "newest"
  | "oldest"
  | "price"
  | "name"
  | "popularity";

export type ProductSortOrder = "asc" | "desc";

export interface ProductDiscoveryQuery {
  page?: number;
  limit?: number;
  search?: string;
  city?: string;
  categoryId?: string;
  sellerId?: string;
  minPrice?: string;
  maxPrice?: string;
  stock?: ProductStockFilter;
  sortBy?: ProductSortBy;
  sortOrder?: ProductSortOrder;
}

export interface ProductDiscoveryResult {
  products: Product[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
