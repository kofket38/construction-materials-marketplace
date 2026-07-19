export class OrderProductNotFoundError extends Error {
  constructor(productId: string) {
    super(`Product ${productId} was not found.`);
    this.name = "OrderProductNotFoundError";
  }
}

export class InsufficientProductStockError extends Error {
  constructor(productId: string) {
    super(`Insufficient stock for product ${productId}.`);
    this.name = "InsufficientProductStockError";
  }
}

export class OwnProductOrderError extends Error {
  constructor() {
    super("Customers cannot order their own products.");
    this.name = "OwnProductOrderError";
  }
}

export class OrderCustomerNotFoundError extends Error {
  constructor() {
    super("The authenticated customer no longer exists.");
    this.name = "OrderCustomerNotFoundError";
  }
}

export class OrderNotPendingError extends Error {
  constructor() {
    super("Only pending orders can be cancelled by customers.");
    this.name = "OrderNotPendingError";
  }
}

export class OrderAlreadyCancelledError extends Error {
  constructor() {
    super("The order is already cancelled.");
    this.name = "OrderAlreadyCancelledError";
  }
}

export class OrderTerminalStatusError extends Error {
  constructor() {
    super("A delivered or cancelled order cannot change status.");
    this.name = "OrderTerminalStatusError";
  }
}

export class OrderStateChangedError extends Error {
  constructor() {
    super("The order changed while the request was being processed.");
    this.name = "OrderStateChangedError";
  }
}
