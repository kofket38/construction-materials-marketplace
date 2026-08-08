export class SellerOrderStateChangedError extends Error {
  constructor() {
    super("The order changed while the request was being processed.");
    this.name = "SellerOrderStateChangedError";
  }
}
