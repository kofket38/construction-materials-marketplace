import {
  DuplicateReviewError,
  ReviewProductNotFoundError,
  ReviewPurchaseRequiredError,
} from "../repositories/review.errors.js";
import type {
  ReviewEntity,
  ReviewListResult,
  ReviewRepository,
} from "../repositories/review.repository.js";
import type { AuthenticatedUser } from "../types/auth.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../utils/api-error.js";
import type {
  CreateReviewBody,
  UpdateReviewBody,
} from "../validators/review.validators.js";

export class ReviewService {
  constructor(private readonly reviews: ReviewRepository) {}

  async create(
    productId: string,
    actor: AuthenticatedUser,
    input: CreateReviewBody,
  ): Promise<ReviewEntity> {
    this.requireCustomer(actor);

    try {
      return await this.reviews.create({
        productId,
        customerId: actor.userId,
        rating: input.rating,
        ...(input.comment !== undefined
          ? { comment: input.comment }
          : {}),
      });
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  async findByProductId(productId: string): Promise<ReviewListResult> {
    try {
      return await this.reviews.findByProductId(productId);
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  async update(
    id: string,
    actor: AuthenticatedUser,
    input: UpdateReviewBody,
  ): Promise<ReviewEntity> {
    this.requireCustomer(actor);
    const review = await this.requireReview(id);

    if (review.customerId !== actor.userId) {
      throw new ForbiddenError("You can only update your own reviews.");
    }

    const updated = await this.reviews.update(id, {
      ...(input.rating !== undefined ? { rating: input.rating } : {}),
      ...(input.comment !== undefined
        ? { comment: input.comment }
        : {}),
    });
    if (!updated) {
      throw new NotFoundError("Review not found.");
    }

    return updated;
  }

  async delete(id: string, actor: AuthenticatedUser): Promise<void> {
    const review = await this.requireReview(id);

    if (actor.role !== "ADMIN") {
      this.requireCustomer(actor);
      if (review.customerId !== actor.userId) {
        throw new ForbiddenError("You can only delete your own reviews.");
      }
    }

    if (!(await this.reviews.delete(id))) {
      throw new NotFoundError("Review not found.");
    }
  }

  private async requireReview(id: string): Promise<ReviewEntity> {
    const review = await this.reviews.findById(id);
    if (!review) {
      throw new NotFoundError("Review not found.");
    }
    return review;
  }

  private requireCustomer(actor: AuthenticatedUser): void {
    if (actor.role !== "CUSTOMER") {
      throw new ForbiddenError("Customer access is required.");
    }
  }

  private handleRepositoryError(error: unknown): never {
    if (error instanceof DuplicateReviewError) {
      throw new ConflictError(error.message);
    }
    if (error instanceof ReviewProductNotFoundError) {
      throw new NotFoundError(error.message);
    }
    if (error instanceof ReviewPurchaseRequiredError) {
      throw new ForbiddenError(error.message);
    }

    throw error;
  }
}
