export class DuplicateWishlistItemError extends Error {
  constructor() {
    super("Product is already in your wishlist.");
    this.name = "DuplicateWishlistItemError";
  }
}

export class WishlistProductNotFoundError extends Error {
  constructor() {
    super("Product not found.");
    this.name = "WishlistProductNotFoundError";
  }
}
