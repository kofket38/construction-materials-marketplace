import {
  DuplicateSupplierQuoteError,
  QuotedProductCategoryError,
  QuotedProductNotFoundError,
  QuotedProductOwnershipError,
  RfqCategoryNotFoundError,
  RfqExpiredError,
  RfqHasQuotesError,
  RfqInsufficientStockError,
  RfqNotFoundError,
  RfqNotOpenError,
  RfqOwnershipError,
  RfqPreferredProductCategoryError,
  RfqPreferredProductNotFoundError,
  RfqQuotedProductUnavailableError,
  RfqStateChangedError,
  SellerNotEligibleForRfqError,
  SupplierQuoteCoverageError,
  SupplierQuoteAmountTooLargeError,
  SupplierQuoteCustomerError,
  SupplierQuoteExpiredError,
  SupplierQuoteNotFoundError,
  SupplierQuoteNotSubmittedError,
  SupplierQuoteOwnershipError,
  SupplierQuoteSellerInactiveError,
  SupplierQuoteValidityError,
} from "../repositories/rfq.errors.js";
import type {
  AcceptQuoteResult,
  RequestForQuoteEntity,
  RfqListResult,
  RfqRepository,
  SellerRfqListQuery,
  SupplierQuoteEntity,
} from "../repositories/rfq.repository.js";
import type { AuthenticatedUser } from "../types/auth.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../utils/api-error.js";
import type {
  CreateRfqBody,
  CreateSupplierQuoteBody,
  RfqListQueryParams,
  SellerRfqListQueryParams,
  UpdateRfqBody,
  UpdateSupplierQuoteBody,
} from "../validators/rfq.validators.js";

const MIN_RFQ_LIFETIME_MS = 24 * 60 * 60 * 1000;
const MAX_RFQ_LIFETIME_MS = 90 * 24 * 60 * 60 * 1000;

export class RfqService {
  constructor(private readonly rfqs: RfqRepository) {}

  async create(
    actor: AuthenticatedUser,
    input: CreateRfqBody,
  ): Promise<RequestForQuoteEntity> {
    this.requireCustomer(actor);
    const expiresAt = this.parseRfqExpiry(input.expiresAt);

    try {
      return await this.rfqs.create({
        customerId: actor.userId,
        title: input.title,
        deliveryLocation: input.deliveryLocation,
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        expiresAt,
        items: mapRfqItems(input.items),
      });
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  async findMyRfqs(
    actor: AuthenticatedUser,
    query: RfqListQueryParams,
  ): Promise<RfqListResult> {
    this.requireCustomer(actor);
    return this.rfqs.findByCustomer(actor.userId, normalizeListQuery(query));
  }

  async findSellerRfqs(
    actor: AuthenticatedUser,
    query: SellerRfqListQueryParams,
  ): Promise<RfqListResult> {
    this.requireSeller(actor);
    const normalized: SellerRfqListQuery = {
      ...normalizeListQuery(query),
      view: query.view ?? "available",
    };
    const result = await this.rfqs.findForSeller(actor.userId, normalized);
    return {
      ...result,
      rfqs: result.rfqs.map((rfq) =>
        visibleToSeller(rfq, actor.userId),
      ),
    };
  }

  async findAdminRfqs(
    actor: AuthenticatedUser,
    query: RfqListQueryParams,
  ): Promise<RfqListResult> {
    this.requireAdmin(actor);
    return this.rfqs.findForAdmin(normalizeListQuery(query));
  }

  async findById(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<RequestForQuoteEntity> {
    const rfq =
      actor.role === "SELLER"
        ? await this.rfqs.findByIdForSeller(id, actor.userId)
        : await this.rfqs.findById(id);
    if (!rfq) {
      throw new NotFoundError("RFQ not found.");
    }

    if (actor.role === "ADMIN") {
      return rfq;
    }
    if (actor.role === "CUSTOMER") {
      if (rfq.customerId !== actor.userId) {
        throw new ForbiddenError("You can only view your own RFQs.");
      }
      return rfq;
    }
    if (actor.role === "SELLER") {
      if (!(await this.rfqs.isSellerEligible(id, actor.userId))) {
        throw new ForbiddenError(
          "This RFQ is not available to the authenticated seller.",
        );
      }
      return visibleToSeller(rfq, actor.userId);
    }

    throw new ForbiddenError();
  }

  async update(
    id: string,
    actor: AuthenticatedUser,
    input: UpdateRfqBody,
  ): Promise<RequestForQuoteEntity> {
    this.requireCustomer(actor);
    const expiresAt = this.parseRfqExpiry(input.expiresAt);

    try {
      return await this.rfqs.update(id, actor.userId, {
        title: input.title,
        deliveryLocation: input.deliveryLocation,
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        expiresAt,
        items: mapRfqItems(input.items),
      });
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  async cancel(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<RequestForQuoteEntity> {
    this.requireCustomer(actor);
    try {
      return await this.rfqs.cancel(id, actor.userId);
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  async createQuote(
    rfqId: string,
    actor: AuthenticatedUser,
    input: CreateSupplierQuoteBody,
  ): Promise<SupplierQuoteEntity> {
    this.requireSeller(actor);
    try {
      return await this.rfqs.createQuote({
        rfqId,
        sellerId: actor.userId,
        validUntil: new Date(input.validUntil),
        leadTimeDays: input.leadTimeDays,
        ...(input.terms !== undefined ? { terms: input.terms } : {}),
        items: input.items,
      });
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  async updateQuote(
    id: string,
    actor: AuthenticatedUser,
    input: UpdateSupplierQuoteBody,
  ): Promise<SupplierQuoteEntity> {
    this.requireSeller(actor);
    try {
      return await this.rfqs.updateQuote(id, actor.userId, {
        validUntil: new Date(input.validUntil),
        leadTimeDays: input.leadTimeDays,
        ...(input.terms !== undefined ? { terms: input.terms } : {}),
        items: input.items,
      });
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  async withdrawQuote(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<SupplierQuoteEntity> {
    this.requireSeller(actor);
    try {
      return await this.rfqs.withdrawQuote(id, actor.userId);
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  async rejectQuote(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<SupplierQuoteEntity> {
    this.requireCustomer(actor);
    try {
      return await this.rfqs.rejectQuote(id, actor.userId);
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  async acceptQuote(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<AcceptQuoteResult> {
    this.requireCustomer(actor);
    try {
      return await this.rfqs.acceptQuote(id, actor.userId);
    } catch (error) {
      this.handleRepositoryError(error);
    }
  }

  private parseRfqExpiry(value: string): Date {
    const expiresAt = new Date(value);
    const lifetime = expiresAt.getTime() - Date.now();
    if (
      lifetime < MIN_RFQ_LIFETIME_MS ||
      lifetime > MAX_RFQ_LIFETIME_MS
    ) {
      throw new BadRequestError(
        "RFQ expiry must be between 24 hours and 90 days from now.",
      );
    }
    return expiresAt;
  }

  private requireCustomer(actor: AuthenticatedUser): void {
    if (actor.role !== "CUSTOMER") {
      throw new ForbiddenError("Customer access is required.");
    }
  }

  private requireSeller(actor: AuthenticatedUser): void {
    if (actor.role !== "SELLER") {
      throw new ForbiddenError("Seller access is required.");
    }
  }

  private requireAdmin(actor: AuthenticatedUser): void {
    if (actor.role !== "ADMIN") {
      throw new ForbiddenError("Administrator access is required.");
    }
  }

  private handleRepositoryError(error: unknown): never {
    if (
      error instanceof RfqNotFoundError ||
      error instanceof SupplierQuoteNotFoundError ||
      error instanceof RfqCategoryNotFoundError ||
      error instanceof RfqPreferredProductNotFoundError ||
      error instanceof QuotedProductNotFoundError
    ) {
      throw new NotFoundError(error.message);
    }
    if (
      error instanceof RfqOwnershipError ||
      error instanceof SupplierQuoteOwnershipError ||
      error instanceof SupplierQuoteCustomerError ||
      error instanceof SellerNotEligibleForRfqError ||
      error instanceof QuotedProductOwnershipError
    ) {
      throw new ForbiddenError(error.message);
    }
    if (
      error instanceof RfqPreferredProductCategoryError ||
      error instanceof QuotedProductCategoryError ||
      error instanceof SupplierQuoteCoverageError ||
      error instanceof SupplierQuoteAmountTooLargeError ||
      error instanceof SupplierQuoteValidityError
    ) {
      throw new BadRequestError(error.message);
    }
    if (
      error instanceof RfqExpiredError ||
      error instanceof RfqNotOpenError ||
      error instanceof RfqHasQuotesError ||
      error instanceof DuplicateSupplierQuoteError ||
      error instanceof SupplierQuoteNotSubmittedError ||
      error instanceof SupplierQuoteExpiredError ||
      error instanceof SupplierQuoteSellerInactiveError ||
      error instanceof RfqQuotedProductUnavailableError ||
      error instanceof RfqInsufficientStockError ||
      error instanceof RfqStateChangedError
    ) {
      throw new ConflictError(error.message);
    }

    throw error;
  }
}

function normalizeListQuery(query: RfqListQueryParams) {
  return {
    page: Number(query.page ?? 1),
    limit: Number(query.limit ?? 20),
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.categoryId !== undefined
      ? { categoryId: query.categoryId }
      : {}),
  };
}

function visibleToSeller(
  rfq: RequestForQuoteEntity,
  sellerId: string,
): RequestForQuoteEntity {
  return {
    ...rfq,
    quotes: rfq.quotes.filter((quote) => quote.sellerId === sellerId),
  };
}

function mapRfqItems(
  items: CreateRfqBody["items"],
) {
  return items.map((item) => ({
    categoryId: item.categoryId,
    ...(item.preferredProductId !== undefined
      ? { preferredProductId: item.preferredProductId }
      : {}),
    materialName: item.materialName,
    ...(item.specifications !== undefined
      ? { specifications: item.specifications }
      : {}),
    requestedQuantity: item.requestedQuantity,
    requestedUnit: item.requestedUnit,
    ...(item.customUnit !== undefined
      ? { customUnit: item.customUnit }
      : {}),
  }));
}
