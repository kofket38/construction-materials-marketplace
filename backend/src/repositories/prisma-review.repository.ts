import {
  Prisma,
  type PrismaClient,
} from "../prisma/generated/client.js";
import {
  DuplicateReviewError,
  ReviewProductNotFoundError,
  ReviewPurchaseRequiredError,
} from "./review.errors.js";
import type {
  CreateReviewInput,
  ReviewEntity,
  ReviewListResult,
  ReviewRepository,
  UpdateReviewInput,
} from "./review.repository.js";

const reviewRelations = {
  customer: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.ReviewInclude;

type ReviewWithCustomer = Prisma.ReviewGetPayload<{
  include: typeof reviewRelations;
}>;

function mapReview(review: ReviewWithCustomer): ReviewEntity {
  return {
    id: review.id,
    productId: review.productId,
    customerId: review.customerId,
    rating: review.rating,
    comment: review.comment,
    customer: review.customer,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

export class PrismaReviewRepository implements ReviewRepository {
  constructor(private readonly client: PrismaClient) {}

  async create(input: CreateReviewInput): Promise<ReviewEntity> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const product = await transaction.product.findUnique({
          where: { id: input.productId },
          select: { id: true },
        });
        if (!product) {
          throw new ReviewProductNotFoundError();
        }

        const deliveredPurchase = await transaction.orderItem.findFirst({
          where: {
            productId: input.productId,
            order: {
              is: {
                customerId: input.customerId,
                status: "DELIVERED",
              },
            },
          },
          select: { id: true },
        });
        if (!deliveredPurchase) {
          throw new ReviewPurchaseRequiredError();
        }

        const review = await transaction.review.create({
          data: {
            productId: input.productId,
            customerId: input.customerId,
            rating: input.rating,
            ...(input.comment !== undefined
              ? { comment: input.comment }
              : {}),
          },
          include: reviewRelations,
        });

        return mapReview(review);
      });
    } catch (error) {
      if (hasPrismaCode(error, "P2002")) {
        throw new DuplicateReviewError();
      }
      if (hasPrismaCode(error, "P2003")) {
        throw new ReviewProductNotFoundError();
      }

      throw error;
    }
  }

  async findByProductId(productId: string): Promise<ReviewListResult> {
    return this.client.$transaction(async (transaction) => {
      const product = await transaction.product.findUnique({
        where: { id: productId },
        select: { id: true },
      });
      if (!product) {
        throw new ReviewProductNotFoundError();
      }

      const reviews = await transaction.review.findMany({
        where: { productId },
        include: reviewRelations,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      });

      return summarizeReviews(reviews.map(mapReview));
    });
  }

  async findById(id: string): Promise<ReviewEntity | null> {
    const review = await this.client.review.findUnique({
      where: { id },
      include: reviewRelations,
    });

    return review ? mapReview(review) : null;
  }

  async update(
    id: string,
    input: UpdateReviewInput,
  ): Promise<ReviewEntity | null> {
    try {
      const review = await this.client.review.update({
        where: { id },
        data: {
          ...(input.rating !== undefined
            ? { rating: input.rating }
            : {}),
          ...(input.comment !== undefined
            ? { comment: input.comment }
            : {}),
        },
        include: reviewRelations,
      });

      return mapReview(review);
    } catch (error) {
      if (hasPrismaCode(error, "P2025")) {
        return null;
      }

      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.client.review.delete({ where: { id } });
      return true;
    } catch (error) {
      if (hasPrismaCode(error, "P2025")) {
        return false;
      }

      throw error;
    }
  }
}

function summarizeReviews(reviews: ReviewEntity[]): ReviewListResult {
  const reviewCount = reviews.length;
  const averageRating =
    reviewCount === 0
      ? null
      : Number(
          (
            reviews.reduce((sum, review) => sum + review.rating, 0) /
            reviewCount
          ).toFixed(2),
        );

  return {
    reviews,
    averageRating,
    reviewCount,
  };
}
