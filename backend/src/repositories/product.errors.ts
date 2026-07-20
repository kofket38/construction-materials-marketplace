export class ProductCategoryNotFoundError extends Error {
  constructor() {
    super("The selected category does not exist.");
    this.name = "ProductCategoryNotFoundError";
  }
}

export class ProductSellerNotFoundError extends Error {
  constructor() {
    super("The authenticated seller no longer exists.");
    this.name = "ProductSellerNotFoundError";
  }
}

export class ProductInUseError extends Error {
  constructor() {
    super("The product is referenced by an existing order.");
    this.name = "ProductInUseError";
  }
}

export class ProductImageLimitError extends Error {
  constructor(limit: number) {
    super(`A product can have at most ${limit} images.`);
    this.name = "ProductImageLimitError";
  }
}
