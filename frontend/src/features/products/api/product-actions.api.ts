import { apiClient } from "@/shared/api/http-client";
import type { ApiSuccessResponse } from "@/shared/api/api.types";

import type { Product } from "@/features/products/model/product";

export interface WishlistItem {
  id: string;
  customerId: string;
  productId: string;
  product: Product;
  createdAt: string;
}

interface WishlistData {
  wishlistItems: WishlistItem[];
}

interface WishlistItemData {
  wishlistItem: WishlistItem;
}

export type RfqUnit =
  | "BAG"
  | "KG"
  | "TONNE"
  | "LITRE"
  | "METRE"
  | "SQUARE_METRE"
  | "CUBIC_METRE"
  | "PIECE"
  | "ROLL"
  | "PALLET"
  | "LOAD";

export interface ProductQuoteRequestInput {
  deliveryLocation: string;
  expiresAt: string;
  notes?: string;
  product: {
    categoryId: string;
    description: string;
    id: string;
    name: string;
  };
  requestedQuantity: string;
  requestedUnit: RfqUnit;
}

export interface ProductQuoteRequestResult {
  id: string;
  status: "OPEN" | "AWARDED" | "CANCELLED" | "EXPIRED";
}

interface ProductQuoteRequestData {
  rfq: ProductQuoteRequestResult;
}

export async function getWishlist(
  signal?: AbortSignal,
): Promise<WishlistItem[]> {
  const response = await apiClient.get<ApiSuccessResponse<WishlistData>>(
    "/wishlist",
    { signal },
  );

  return response.data.data.wishlistItems;
}

export async function addProductToWishlist(
  productId: string,
): Promise<WishlistItem> {
  const response = await apiClient.post<
    ApiSuccessResponse<WishlistItemData>
  >(`/wishlist/${encodeURIComponent(productId)}`, {});

  return response.data.data.wishlistItem;
}

export async function removeProductFromWishlist(
  productId: string,
): Promise<void> {
  await apiClient.delete<ApiSuccessResponse<null>>(
    `/wishlist/${encodeURIComponent(productId)}`,
    { data: {} },
  );
}

export interface SubmitReviewInput {
  rating: number;
  comment?: string;
}

export interface ReviewEntity {
  id: string;
  productId: string;
  customerId: string;
  rating: number;
  comment: string | null;
  customer: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

interface ReviewData {
  review: ReviewEntity;
}

export async function submitReview(
  productId: string,
  input: SubmitReviewInput,
): Promise<ReviewEntity> {
  const response = await apiClient.post<ApiSuccessResponse<ReviewData>>(
    `/products/${encodeURIComponent(productId)}/reviews`,
    {
      rating: input.rating,
      ...(input.comment?.trim() ? { comment: input.comment.trim() } : {}),
    },
  );
  return response.data.data.review;
}

export async function requestProductQuote(
  input: ProductQuoteRequestInput,
): Promise<ProductQuoteRequestResult> {
  const title = `Request for ${input.product.name}`.slice(0, 200);
  const response = await apiClient.post<
    ApiSuccessResponse<ProductQuoteRequestData>
  >("/rfqs", {
    title,
    deliveryLocation: input.deliveryLocation,
    expiresAt: input.expiresAt,
    ...(input.notes ? { notes: input.notes } : {}),
    items: [
      {
        categoryId: input.product.categoryId,
        preferredProductId: input.product.id,
        materialName: input.product.name,
        specifications: input.product.description,
        requestedQuantity: input.requestedQuantity,
        requestedUnit: input.requestedUnit,
      },
    ],
  });

  return response.data.data.rfq;
}
