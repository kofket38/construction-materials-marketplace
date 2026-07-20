export class DuplicateReviewError extends Error {
  constructor() {
    super("You have already reviewed this product.");
    this.name = "DuplicateReviewError";
  }
}

export class ReviewProductNotFoundError extends Error {
  constructor() {
    super("Product not found.");
    this.name = "ReviewProductNotFoundError";
  }
}

export class ReviewPurchaseRequiredError extends Error {
  constructor() {
    super(
      "You can only review products from your delivered orders.",
    );
    this.name = "ReviewPurchaseRequiredError";
  }
}
