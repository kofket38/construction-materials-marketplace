export interface ReviewCustomerSummary {
  id: string;
  name: string;
}

export interface ReviewEntity {
  id: string;
  productId: string;
  customerId: string;
  rating: number;
  comment: string | null;
  customer: ReviewCustomerSummary;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewListResult {
  reviews: ReviewEntity[];
  averageRating: number | null;
  reviewCount: number;
}

export interface CreateReviewInput {
  productId: string;
  customerId: string;
  rating: number;
  comment?: string;
}

export interface UpdateReviewInput {
  rating?: number;
  comment?: string | null;
}

export interface ReviewRepository {
  create(input: CreateReviewInput): Promise<ReviewEntity>;
  findByProductId(productId: string): Promise<ReviewListResult>;
  findById(id: string): Promise<ReviewEntity | null>;
  update(
    id: string,
    input: UpdateReviewInput,
  ): Promise<ReviewEntity | null>;
  delete(id: string): Promise<boolean>;
}
