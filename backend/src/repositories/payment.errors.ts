export class PaymentAlreadySubmittedError extends Error {
  constructor() {
    super("Payment proof has already been submitted for this order.");
    this.name = "PaymentAlreadySubmittedError";
  }
}

export class PaymentOrderStateChangedError extends Error {
  constructor() {
    super("The order is no longer awaiting bank transfer payment.");
    this.name = "PaymentOrderStateChangedError";
  }
}
