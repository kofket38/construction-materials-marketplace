export interface SellerInventoryEntity {
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
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSellerInventoryInput {
  sellerId: string;
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

export interface SellerInventoryListInput {
  sellerId: string;
  page: number;
  limit: number;
  search?: string;
  city?: string;
}

export interface SellerInventoryListResult {
  inventory: SellerInventoryEntity[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SellerInventoryRepository {
  list(input: SellerInventoryListInput): Promise<SellerInventoryListResult>;
  findById(id: string): Promise<SellerInventoryEntity | null>;
  create(input: CreateSellerInventoryInput): Promise<SellerInventoryEntity>;
  update(
    id: string,
    input: UpdateSellerInventoryInput,
  ): Promise<SellerInventoryEntity | null>;
  delete(id: string): Promise<boolean>;
}
