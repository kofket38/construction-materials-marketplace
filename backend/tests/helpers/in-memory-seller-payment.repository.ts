import type {
  CheckoutSellerResolution,
  SellerPaymentProfile,
  SellerPaymentRepository,
} from "../../src/repositories/seller-payment.repository.js";

export class InMemorySellerPaymentRepository
  implements SellerPaymentRepository
{
  private readonly productSellers = new Map<string, string>();
  private readonly profiles = new Map<string, SellerPaymentProfile>();

  addProduct(productId: string, sellerId: string): void {
    this.productSellers.set(productId, sellerId);
  }

  addProfile(profile: SellerPaymentProfile): void {
    this.profiles.set(profile.sellerId, profile);
  }

  async findBySellerId(
    sellerId: string,
  ): Promise<SellerPaymentProfile | null> {
    return this.profiles.get(sellerId) ?? null;
  }

  async resolveCheckoutSellers(
    productIds: string[],
  ): Promise<CheckoutSellerResolution> {
    const uniqueProductIds = [...new Set(productIds)];
    const missingProductIds = uniqueProductIds.filter(
      (productId) => !this.productSellers.has(productId),
    );
    const sellerIds = [
      ...new Set(
        uniqueProductIds.flatMap((productId) => {
          const sellerId = this.productSellers.get(productId);
          return sellerId ? [sellerId] : [];
        }),
      ),
    ];

    return { missingProductIds, sellerIds };
  }
}
