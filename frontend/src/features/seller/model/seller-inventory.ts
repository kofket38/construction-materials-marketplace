import type { Product } from "@/features/products/model/product";

export type SellerInventoryStockFilter =
  | "in_stock"
  | "low_stock"
  | "out_of_stock";

export interface SellerInventorySummary {
  totalProducts: number;
  lowStock: number;
  outOfStock: number;
  inventoryValue: string;
}

export interface SellerInventoryResult {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  inventorySummary: SellerInventorySummary;
}

export interface UpdateSellerInventoryProductInput {
  name: string;
  price: string;
  quantity: number;
}
