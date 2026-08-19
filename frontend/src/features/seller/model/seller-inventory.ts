export type SellerInventoryStockFilter =
  | "in_stock"
  | "low_stock"
  | "out_of_stock";

export interface SellerInventoryEntry {
  id: string;
  sellerId: string;
  productId: string;
  productName: string;
  productImageUrl: string | null;
  city: string;
  region: string | null;
  price: string;
  quantity: number;
  deliveryAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SellerInventoryResult {
  inventory: SellerInventoryEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Legacy — used by the existing seller product list page (GET /seller/products)
export interface SellerInventorySummary {
  totalProducts: number;
  lowStock: number;
  outOfStock: number;
  inventoryValue: string;
}

export interface CreateSellerInventoryInput {
  productId: string;
  city: string;
  region?: string;
  price: string;
  quantity: number;
  deliveryAvailable: boolean;
}

export interface UpdateSellerInventoryInput {
  city?: string;
  region?: string | null;
  price?: string;
  quantity?: number;
  deliveryAvailable?: boolean;
}

// Legacy — still used by the existing InventoryEditDialog path on product management
export interface UpdateSellerInventoryProductInput {
  name: string;
  price: string;
  quantity: number;
}
