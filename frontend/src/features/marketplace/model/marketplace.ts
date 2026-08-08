export interface MarketplaceCity {
  name: string;
  productCount: number;
  sellerCount: number;
}

export interface MarketplaceSeller {
  id: string;
  name: string;
  shopName: string | null;
  city: string;
  productCount: number;
  averageRating: number | null;
  reviewCount: number;
}

export interface SellerStore {
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
  joinedAt: string;
}
