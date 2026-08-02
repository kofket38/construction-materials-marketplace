export class RfqNotFoundError extends Error {
  constructor() {
    super("RFQ not found.");
    this.name = "RfqNotFoundError";
  }
}

export class RfqCategoryNotFoundError extends Error {
  constructor(categoryId: string) {
    super(`Category ${categoryId} was not found.`);
    this.name = "RfqCategoryNotFoundError";
  }
}

export class RfqPreferredProductNotFoundError extends Error {
  constructor(productId: string) {
    super(`Preferred product ${productId} was not found.`);
    this.name = "RfqPreferredProductNotFoundError";
  }
}

export class RfqPreferredProductCategoryError extends Error {
  constructor() {
    super("A preferred product must belong to the requested category.");
    this.name = "RfqPreferredProductCategoryError";
  }
}

export class RfqOwnershipError extends Error {
  constructor() {
    super("You can only manage your own RFQs.");
    this.name = "RfqOwnershipError";
  }
}

export class RfqNotOpenError extends Error {
  constructor() {
    super("Only open RFQs can be changed.");
    this.name = "RfqNotOpenError";
  }
}

export class RfqHasQuotesError extends Error {
  constructor() {
    super("An RFQ cannot be edited after a quotation has been submitted.");
    this.name = "RfqHasQuotesError";
  }
}

export class RfqExpiredError extends Error {
  constructor() {
    super("The RFQ has expired.");
    this.name = "RfqExpiredError";
  }
}

export class SellerNotEligibleForRfqError extends Error {
  constructor() {
    super("The seller is not eligible to quote every requested category.");
    this.name = "SellerNotEligibleForRfqError";
  }
}

export class DuplicateSupplierQuoteError extends Error {
  constructor() {
    super("The seller has already submitted a quotation for this RFQ.");
    this.name = "DuplicateSupplierQuoteError";
  }
}

export class SupplierQuoteNotFoundError extends Error {
  constructor() {
    super("Supplier quotation not found.");
    this.name = "SupplierQuoteNotFoundError";
  }
}

export class SupplierQuoteOwnershipError extends Error {
  constructor() {
    super("You can only manage your own supplier quotations.");
    this.name = "SupplierQuoteOwnershipError";
  }
}

export class SupplierQuoteNotSubmittedError extends Error {
  constructor() {
    super("Only submitted quotations can be changed.");
    this.name = "SupplierQuoteNotSubmittedError";
  }
}

export class SupplierQuoteCoverageError extends Error {
  constructor() {
    super("A quotation must cover every RFQ item exactly once.");
    this.name = "SupplierQuoteCoverageError";
  }
}

export class QuotedProductNotFoundError extends Error {
  constructor(productId: string) {
    super(`Quoted product ${productId} was not found.`);
    this.name = "QuotedProductNotFoundError";
  }
}

export class QuotedProductOwnershipError extends Error {
  constructor() {
    super("Every quoted product must belong to the authenticated seller.");
    this.name = "QuotedProductOwnershipError";
  }
}

export class QuotedProductCategoryError extends Error {
  constructor() {
    super("Every quoted product must match its requested category.");
    this.name = "QuotedProductCategoryError";
  }
}

export class SupplierQuoteValidityError extends Error {
  constructor() {
    super("Quotation validity must end on or before the RFQ expires.");
    this.name = "SupplierQuoteValidityError";
  }
}

export class SupplierQuoteAmountTooLargeError extends Error {
  constructor() {
    super("The supplier quotation total exceeds the supported amount.");
    this.name = "SupplierQuoteAmountTooLargeError";
  }
}

export class SupplierQuoteCustomerError extends Error {
  constructor() {
    super("You can only decide quotations submitted to your own RFQ.");
    this.name = "SupplierQuoteCustomerError";
  }
}

export class SupplierQuoteExpiredError extends Error {
  constructor() {
    super("The supplier quotation has expired.");
    this.name = "SupplierQuoteExpiredError";
  }
}

export class SupplierQuoteSellerInactiveError extends Error {
  constructor() {
    super("The supplier account is no longer active.");
    this.name = "SupplierQuoteSellerInactiveError";
  }
}

export class RfqQuotedProductUnavailableError extends Error {
  constructor(productId: string | null) {
    super(
      productId
        ? `Quoted product ${productId} is no longer available.`
        : "A quoted product is no longer available.",
    );
    this.name = "RfqQuotedProductUnavailableError";
  }
}

export class RfqInsufficientStockError extends Error {
  constructor(productId: string) {
    super(`Insufficient stock for quoted product ${productId}.`);
    this.name = "RfqInsufficientStockError";
  }
}

export class RfqStateChangedError extends Error {
  constructor() {
    super("The RFQ changed while the request was being processed.");
    this.name = "RfqStateChangedError";
  }
}
