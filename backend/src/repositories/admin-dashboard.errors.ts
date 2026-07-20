export class AdminProductInUseError extends Error {
  constructor() {
    super("The product cannot be removed because it is referenced by an order.");
    this.name = "AdminProductInUseError";
  }
}
