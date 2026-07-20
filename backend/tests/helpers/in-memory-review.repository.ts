import { randomUUID } from "node:crypto";
import {
  DuplicateReviewError,
  ReviewProductNotFoundError,
  ReviewPurchaseRequiredError,
} from "../../src/repositories/review.errors.js";
import type {
  CreateReviewInput,
  ReviewEntity,
  ReviewListResult,
  ReviewRepository,
  UpdateReviewInput,
} from "../../src/repositories/review.repository.js";

interface CustomerSeed {
  id: string;
  name: string;
}

interface ReviewSummaryTarget {
  setReviewRatings(productId: string, ratings: number[]): void;
}

export class InMemoryReviewRepository implements ReviewRepository {
  private readonly products = new Set<string>();
  private readonly customers = new Map<string, CustomerSeed>();
  private readonly deliveredPurchases = new Set<string>();
  private readonly reviews = new Map<string, ReviewEntity>();

  constructor(private readonly summaryTarget?: ReviewSummaryTarget) {}

  addProduct(productId: string): void {
    this.products.add(productId);
  }

  addCustomer(customer: CustomerSeed): void {
    this.customers.set(customer.id, { ...customer });
  }

  markDeliveredPurchase(customerId: string, productId: string): void {
    this.deliveredPurchases.add(purchaseKey(customerId, productId));
  }

  setCreatedAt(reviewId: string, createdAt: Date): void {
    const review = this.reviews.get(reviewId);
    if (!review) {
      throw new Error(`Test review ${reviewId} was not found.`);
    }
    review.createdAt = createdAt;
  }

  async create(input: CreateReviewInput): Promise<ReviewEntity> {
    if (!this.products.has(input.productId)) {
      throw new ReviewProductNotFoundError();
    }
    if (
      !this.deliveredPurchases.has(
        purchaseKey(input.customerId, input.productId),
      )
    ) {
      throw new ReviewPurchaseRequiredError();
    }
    if (
      [...this.reviews.values()].some(
        (review) =>
          review.customerId === input.customerId &&
          review.productId === input.productId,
      )
    ) {
      throw new DuplicateReviewError();
    }

    const now = new Date();
    const customer = this.customers.get(input.customerId) ?? {
      id: input.customerId,
      name: "Test Customer",
    };
    const review: ReviewEntity = {
      id: randomUUID(),
      productId: input.productId,
      customerId: input.customerId,
      rating: input.rating,
      comment: input.comment ?? null,
      customer: { ...customer },
      createdAt: now,
      updatedAt: now,
    };

    this.reviews.set(review.id, review);
    this.refreshSummary(input.productId);
    return review;
  }

  async findByProductId(productId: string): Promise<ReviewListResult> {
    if (!this.products.has(productId)) {
      throw new ReviewProductNotFoundError();
    }

    const reviews = [...this.reviews.values()]
      .filter((review) => review.productId === productId)
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() ||
          left.id.localeCompare(right.id),
      );

    return summarizeReviews(reviews);
  }

  async findById(id: string): Promise<ReviewEntity | null> {
    return this.reviews.get(id) ?? null;
  }

  async update(
    id: string,
    input: UpdateReviewInput,
  ): Promise<ReviewEntity | null> {
    const review = this.reviews.get(id);
    if (!review) {
      return null;
    }

    if (input.rating !== undefined) {
      review.rating = input.rating;
    }
    if (input.comment !== undefined) {
      review.comment = input.comment;
    }
    review.updatedAt = new Date();
    this.refreshSummary(review.productId);
    return review;
  }

  async delete(id: string): Promise<boolean> {
    const review = this.reviews.get(id);
    if (!review) {
      return false;
    }

    this.reviews.delete(id);
    this.refreshSummary(review.productId);
    return true;
  }

  private refreshSummary(productId: string): void {
    this.summaryTarget?.setReviewRatings(
      productId,
      [...this.reviews.values()]
        .filter((review) => review.productId === productId)
        .map((review) => review.rating),
    );
  }
}

function purchaseKey(customerId: string, productId: string): string {
  return `${customerId}:${productId}`;
}

function summarizeReviews(reviews: ReviewEntity[]): ReviewListResult {
  const reviewCount = reviews.length;
  return {
    reviews,
    averageRating:
      reviewCount === 0
        ? null
        : Number(
            (
              reviews.reduce((sum, review) => sum + review.rating, 0) /
              reviewCount
            ).toFixed(2),
          ),
    reviewCount,
  };
}
