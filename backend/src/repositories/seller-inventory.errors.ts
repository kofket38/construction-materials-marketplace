export class SellerInventoryProductNotFoundError extends Error {
  constructor(productId: string) {
    super(`Product ${productId} was not found.`);
    this.name = "SellerInventoryProductNotFoundError";
  }
}

export class SellerInventoryProductNotOwnedError extends Error {
  constructor() {
    super("You can only manage inventory for your own products.");
    this.name = "SellerInventoryProductNotOwnedError";
  }
}

export class SellerInventoryDuplicateError extends Error {
  constructor() {
    super("An inventory entry already exists for this product.");
    this.name = "SellerInventoryDuplicateError";
  }
}

export class SellerInventoryNotFoundError extends Error {
  constructor() {
    super("Inventory entry not found.");
    this.name = "SellerInventoryNotFoundError";
  }
}
