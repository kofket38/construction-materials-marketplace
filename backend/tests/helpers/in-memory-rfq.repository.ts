import { randomUUID } from "node:crypto";
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
  SupplierQuoteCoverageError,
  SupplierQuoteAmountTooLargeError,
  SupplierQuoteCustomerError,
  SupplierQuoteExpiredError,
  SupplierQuoteNotFoundError,
  SupplierQuoteNotSubmittedError,
  SupplierQuoteOwnershipError,
  SupplierQuoteValidityError,
} from "../../src/repositories/rfq.errors.js";
import type {
  AcceptQuoteResult,
  CreateRfqInput,
  CreateSupplierQuoteInput,
  QuoteItemInput,
  RequestForQuoteEntity,
  RfqListQuery,
  RfqListResult,
  RfqRepository,
  RfqSellerSummary,
  SellerRfqListQuery,
  SupplierQuoteEntity,
  UpdateRfqInput,
  UpdateSupplierQuoteInput,
} from "../../src/repositories/rfq.repository.js";
import type {
  OrderEntity,
  OrderItemEntity,
} from "../../src/repositories/order.repository.js";

interface CategorySeed {
  id: string;
  name: string;
}

interface ProductSeed {
  id: string;
  sellerId: string;
  categoryId: string;
  name: string;
  imageUrl: string | null;
  quantity: number;
}

interface CustomerSeed {
  id: string;
  name: string;
  company: string | null;
  email: string;
}

export class InMemoryRfqRepository implements RfqRepository {
  private readonly categories = new Map<string, CategorySeed>();
  private readonly products = new Map<string, ProductSeed>();
  private readonly customers = new Map<string, CustomerSeed>();
  private readonly sellers = new Map<string, RfqSellerSummary>();
  private readonly rfqs = new Map<string, RequestForQuoteEntity>();
  private readonly orders = new Map<string, OrderEntity>();

  addCategory(category: CategorySeed): void {
    this.categories.set(category.id, { ...category });
  }

  addProduct(product: ProductSeed): void {
    this.products.set(product.id, { ...product });
  }

  addCustomer(customer: CustomerSeed): void {
    this.customers.set(customer.id, { ...customer });
  }

  addSeller(seller: RfqSellerSummary): void {
    this.sellers.set(seller.id, { ...seller });
  }

  getProductQuantity(productId: string): number | null {
    return this.products.get(productId)?.quantity ?? null;
  }

  setProductQuantity(productId: string, quantity: number): void {
    const product = this.products.get(productId);
    if (product) {
      product.quantity = quantity;
    }
  }

  removeProduct(productId: string): void {
    this.products.delete(productId);
    for (const rfq of this.rfqs.values()) {
      for (const item of rfq.items) {
        if (item.preferredProductId === productId) {
          item.preferredProductId = null;
          item.preferredProduct = null;
        }
      }
      for (const quote of rfq.quotes) {
        for (const item of quote.items) {
          if (item.productId === productId) {
            item.productId = null;
            item.product = null;
          }
        }
      }
    }
  }

  getOrders(): OrderEntity[] {
    return [...this.orders.values()];
  }

  setRfqExpiresAt(rfqId: string, expiresAt: Date): void {
    const rfq = this.rfqs.get(rfqId);
    if (rfq) {
      rfq.expiresAt = expiresAt;
    }
  }

  async create(input: CreateRfqInput): Promise<RequestForQuoteEntity> {
    const now = new Date();
    const rfqId = randomUUID();
    const items = input.items.map((item) => {
      const category = this.categories.get(item.categoryId);
      if (!category) {
        throw new RfqCategoryNotFoundError(item.categoryId);
      }
      const preferredProduct = item.preferredProductId
        ? this.products.get(item.preferredProductId)
        : undefined;
      if (item.preferredProductId && !preferredProduct) {
        throw new RfqPreferredProductNotFoundError(
          item.preferredProductId,
        );
      }
      if (
        preferredProduct &&
        preferredProduct.categoryId !== item.categoryId
      ) {
        throw new RfqPreferredProductCategoryError();
      }

      return {
        id: randomUUID(),
        rfqId,
        categoryId: item.categoryId,
        preferredProductId: item.preferredProductId ?? null,
        categoryName: category.name,
        materialName: item.materialName,
        specifications: item.specifications ?? null,
        requestedQuantity: Number(item.requestedQuantity).toFixed(3),
        requestedUnit: item.requestedUnit,
        customUnit: item.customUnit ?? null,
        preferredProduct: preferredProduct
          ? productSummary(preferredProduct)
          : null,
        createdAt: now,
      };
    });

    const customer = this.customers.get(input.customerId) ?? {
      id: input.customerId,
      name: "Test Customer",
      company: null,
      email: "customer@example.com",
    };
    const rfq: RequestForQuoteEntity = {
      id: rfqId,
      customerId: input.customerId,
      title: input.title,
      deliveryLocation: input.deliveryLocation,
      notes: input.notes ?? null,
      status: "OPEN",
      expiresAt: input.expiresAt,
      awardedQuoteId: null,
      customer: {
        id: customer.id,
        name: customer.name,
        company: customer.company,
      },
      items,
      quotes: [],
      createdAt: now,
      updatedAt: now,
    };
    this.rfqs.set(rfq.id, rfq);
    return rfq;
  }

  async findById(id: string): Promise<RequestForQuoteEntity | null> {
    this.expireRfqs();
    return this.rfqs.get(id) ?? null;
  }

  async findByCustomer(
    customerId: string,
    query: RfqListQuery,
  ): Promise<RfqListResult> {
    this.expireRfqs();
    return paginate(
      [...this.rfqs.values()].filter(
        (rfq) =>
          rfq.customerId === customerId && matchesQuery(rfq, query),
      ),
      query,
    );
  }

  async findForSeller(
    sellerId: string,
    query: SellerRfqListQuery,
  ): Promise<RfqListResult> {
    this.expireRfqs();
    return paginate(
      [...this.rfqs.values()].filter((rfq) => {
        const inView =
          query.view === "participating"
            ? rfq.quotes.some((quote) => quote.sellerId === sellerId)
            : rfq.status === "OPEN" &&
              this.sellerCoversEveryCategory(rfq, sellerId);
        return inView && matchesQuery(rfq, query);
      }),
      query,
    );
  }

  async findForAdmin(query: RfqListQuery): Promise<RfqListResult> {
    this.expireRfqs();
    return paginate(
      [...this.rfqs.values()].filter((rfq) =>
        matchesQuery(rfq, query),
      ),
      query,
    );
  }

  async isSellerEligible(
    rfqId: string,
    sellerId: string,
  ): Promise<boolean> {
    this.expireRfqs();
    const rfq = this.rfqs.get(rfqId);
    return Boolean(
      rfq &&
        (rfq.quotes.some((quote) => quote.sellerId === sellerId) ||
          (rfq.status === "OPEN" &&
            this.sellerCoversEveryCategory(rfq, sellerId))),
    );
  }

  async update(
    id: string,
    customerId: string,
    input: UpdateRfqInput,
  ): Promise<RequestForQuoteEntity> {
    const current = this.requireOwnedOpenRfq(id, customerId);
    if (current.quotes.length > 0) {
      throw new RfqHasQuotesError();
    }
    this.rfqs.delete(id);
    const replacement = await this.create({ customerId, ...input });
    const temporaryId = replacement.id;
    replacement.id = id;
    replacement.items.forEach((item) => {
      item.rfqId = id;
    });
    replacement.createdAt = current.createdAt;
    this.rfqs.delete(temporaryId);
    this.rfqs.set(id, replacement);
    return replacement;
  }

  async cancel(
    id: string,
    customerId: string,
  ): Promise<RequestForQuoteEntity> {
    const rfq = this.requireOwnedOpenRfq(id, customerId);
    rfq.status = "CANCELLED";
    rfq.updatedAt = new Date();
    for (const quote of rfq.quotes) {
      if (quote.status === "SUBMITTED") {
        quote.status = "CLOSED";
      }
    }
    return rfq;
  }

  async createQuote(
    input: CreateSupplierQuoteInput,
  ): Promise<SupplierQuoteEntity> {
    const rfq = this.requireOpenRfq(input.rfqId);
    if (rfq.quotes.some((quote) => quote.sellerId === input.sellerId)) {
      throw new DuplicateSupplierQuoteError();
    }
    const quote = this.buildQuote(rfq, input.sellerId, input);
    rfq.quotes.unshift(quote);
    rfq.updatedAt = new Date();
    return quote;
  }

  async updateQuote(
    id: string,
    sellerId: string,
    input: UpdateSupplierQuoteInput,
  ): Promise<SupplierQuoteEntity> {
    const { rfq, quote } = this.requireQuote(id);
    this.requireOwnedSubmittedQuote(quote, sellerId);
    this.requireOpenRfq(rfq.id);
    const updated = this.buildQuote(rfq, sellerId, {
      rfqId: rfq.id,
      sellerId,
      ...input,
    });
    updated.id = quote.id;
    updated.createdAt = quote.createdAt;
    const index = rfq.quotes.indexOf(quote);
    rfq.quotes[index] = updated;
    return updated;
  }

  async withdrawQuote(
    id: string,
    sellerId: string,
  ): Promise<SupplierQuoteEntity> {
    const { rfq, quote } = this.requireQuote(id);
    this.requireOwnedSubmittedQuote(quote, sellerId);
    this.requireOpenRfq(rfq.id);
    quote.status = "WITHDRAWN";
    quote.updatedAt = new Date();
    return quote;
  }

  async rejectQuote(
    id: string,
    customerId: string,
  ): Promise<SupplierQuoteEntity> {
    const { rfq, quote } = this.requireQuote(id);
    this.requireCustomerSubmittedQuote(rfq, quote, customerId);
    this.requireOpenRfq(rfq.id);
    quote.status = "REJECTED";
    quote.updatedAt = new Date();
    return quote;
  }

  async acceptQuote(
    id: string,
    customerId: string,
  ): Promise<AcceptQuoteResult> {
    const { rfq, quote } = this.requireQuote(id);
    this.requireCustomerSubmittedQuote(rfq, quote, customerId);
    this.requireOpenRfq(rfq.id);
    if (quote.validUntil.getTime() <= Date.now()) {
      throw new SupplierQuoteExpiredError();
    }

    const products = quote.items.map((item) => {
      if (!item.productId) {
        throw new RfqQuotedProductUnavailableError(null);
      }
      const product = this.products.get(item.productId);
      if (!product || product.sellerId !== quote.sellerId) {
        throw new RfqQuotedProductUnavailableError(item.productId);
      }
      if (product.quantity < item.offeredQuantity) {
        throw new RfqInsufficientStockError(product.id);
      }
      return { item, product };
    });

    const orderId = randomUUID();
    const now = new Date();
    const orderItems: OrderItemEntity[] = products.map(
      ({ item, product }) => {
        product.quantity -= item.offeredQuantity;
        return {
          id: randomUUID(),
          orderId,
          productId: product.id,
          quantity: item.offeredQuantity,
          price: item.unitPrice,
          product: {
            id: product.id,
            sellerId: product.sellerId,
            name: product.name,
            imageUrl: product.imageUrl,
          },
        };
      },
    );
    const customer = this.customers.get(customerId) ?? {
      id: customerId,
      name: "Test Customer",
      company: null,
      email: "customer@example.com",
    };
    const order: OrderEntity = {
      id: orderId,
      customerId,
      status: "PENDING",
      totalAmount: quote.totalAmount,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
      },
      items: orderItems,
      createdAt: now,
      updatedAt: now,
    };
    this.orders.set(order.id, order);

    quote.status = "ACCEPTED";
    quote.orderId = order.id;
    quote.updatedAt = now;
    rfq.status = "AWARDED";
    rfq.awardedQuoteId = quote.id;
    rfq.updatedAt = now;
    for (const competingQuote of rfq.quotes) {
      if (
        competingQuote.id !== quote.id &&
        competingQuote.status === "SUBMITTED"
      ) {
        competingQuote.status = "REJECTED";
        competingQuote.updatedAt = now;
      }
    }
    return { rfq, order };
  }

  private buildQuote(
    rfq: RequestForQuoteEntity,
    sellerId: string,
    input: CreateSupplierQuoteInput,
  ): SupplierQuoteEntity {
    if (
      input.validUntil.getTime() <= Date.now() ||
      input.validUntil.getTime() > rfq.expiresAt.getTime()
    ) {
      throw new SupplierQuoteValidityError();
    }
    const rfqItemIds = new Set(rfq.items.map((item) => item.id));
    const suppliedIds = new Set(input.items.map((item) => item.rfqItemId));
    if (
      input.items.length !== rfq.items.length ||
      suppliedIds.size !== rfqItemIds.size ||
      [...rfqItemIds].some((itemId) => !suppliedIds.has(itemId))
    ) {
      throw new SupplierQuoteCoverageError();
    }

    const now = new Date();
    const quoteId = randomUUID();
    let totalCents = 0;
    const items = input.items.map((item) => {
      const product = this.validateQuotedProduct(rfq, sellerId, item);
      const lineCents =
        toCents(item.unitPrice) * item.offeredQuantity;
      if (lineCents > 99_999_999_999_999) {
        throw new SupplierQuoteAmountTooLargeError();
      }
      totalCents += lineCents;
      return {
        id: randomUUID(),
        quoteId,
        rfqItemId: item.rfqItemId,
        productId: product.id,
        productName: product.name,
        offeredQuantity: item.offeredQuantity,
        unitPrice: Number(item.unitPrice).toFixed(2),
        lineTotal: (lineCents / 100).toFixed(2),
        product: productSummary(product),
        createdAt: now,
      };
    });
    if (totalCents > 99_999_999_999_999) {
      throw new SupplierQuoteAmountTooLargeError();
    }

    const seller = this.sellers.get(sellerId) ?? {
      id: sellerId,
      name: "Test Seller",
      company: null,
      shopName: "Test Shop",
    };
    return {
      id: quoteId,
      rfqId: rfq.id,
      sellerId,
      status: "SUBMITTED",
      validUntil: input.validUntil,
      leadTimeDays: input.leadTimeDays,
      terms: input.terms ?? null,
      totalAmount: (totalCents / 100).toFixed(2),
      orderId: null,
      seller: { ...seller },
      items,
      createdAt: now,
      updatedAt: now,
    };
  }

  private validateQuotedProduct(
    rfq: RequestForQuoteEntity,
    sellerId: string,
    input: QuoteItemInput,
  ): ProductSeed {
    const product = this.products.get(input.productId);
    if (!product) {
      throw new QuotedProductNotFoundError(input.productId);
    }
    if (product.sellerId !== sellerId) {
      throw new QuotedProductOwnershipError();
    }
    const rfqItem = rfq.items.find((item) => item.id === input.rfqItemId);
    if (!rfqItem || product.categoryId !== rfqItem.categoryId) {
      throw new QuotedProductCategoryError();
    }
    return product;
  }

  private requireOwnedOpenRfq(
    id: string,
    customerId: string,
  ): RequestForQuoteEntity {
    const rfq = this.requireOpenRfq(id);
    if (rfq.customerId !== customerId) {
      throw new RfqOwnershipError();
    }
    return rfq;
  }

  private requireOpenRfq(id: string): RequestForQuoteEntity {
    this.expireRfqs();
    const rfq = this.rfqs.get(id);
    if (!rfq) {
      throw new RfqNotFoundError();
    }
    if (rfq.status === "EXPIRED") {
      throw new RfqExpiredError();
    }
    if (rfq.status !== "OPEN") {
      throw new RfqNotOpenError();
    }
    return rfq;
  }

  private requireQuote(id: string): {
    rfq: RequestForQuoteEntity;
    quote: SupplierQuoteEntity;
  } {
    for (const rfq of this.rfqs.values()) {
      const quote = rfq.quotes.find((candidate) => candidate.id === id);
      if (quote) {
        return { rfq, quote };
      }
    }
    throw new SupplierQuoteNotFoundError();
  }

  private requireOwnedSubmittedQuote(
    quote: SupplierQuoteEntity,
    sellerId: string,
  ): void {
    if (quote.sellerId !== sellerId) {
      throw new SupplierQuoteOwnershipError();
    }
    if (quote.status !== "SUBMITTED") {
      throw new SupplierQuoteNotSubmittedError();
    }
  }

  private requireCustomerSubmittedQuote(
    rfq: RequestForQuoteEntity,
    quote: SupplierQuoteEntity,
    customerId: string,
  ): void {
    if (rfq.customerId !== customerId) {
      throw new SupplierQuoteCustomerError();
    }
    if (quote.status !== "SUBMITTED") {
      throw new SupplierQuoteNotSubmittedError();
    }
  }

  private sellerCoversEveryCategory(
    rfq: RequestForQuoteEntity,
    sellerId: string,
  ): boolean {
    return rfq.items.every(
      (item) =>
        item.categoryId !== null &&
        [...this.products.values()].some(
          (product) =>
            product.sellerId === sellerId &&
            product.categoryId === item.categoryId,
        ),
    );
  }

  private expireRfqs(): void {
    const now = Date.now();
    for (const rfq of this.rfqs.values()) {
      if (rfq.status === "OPEN" && rfq.expiresAt.getTime() <= now) {
        rfq.status = "EXPIRED";
        rfq.updatedAt = new Date();
        for (const quote of rfq.quotes) {
          if (quote.status === "SUBMITTED") {
            quote.status = "CLOSED";
            quote.updatedAt = new Date();
          }
        }
      }
    }
  }
}

function paginate(
  rfqs: RequestForQuoteEntity[],
  query: RfqListQuery,
): RfqListResult {
  const sorted = [...rfqs].sort(
    (left, right) =>
      right.createdAt.getTime() - left.createdAt.getTime() ||
      left.id.localeCompare(right.id),
  );
  const start = (query.page - 1) * query.limit;
  return {
    rfqs: sorted.slice(start, start + query.limit),
    pagination: {
      page: query.page,
      limit: query.limit,
      total: sorted.length,
      totalPages: Math.ceil(sorted.length / query.limit),
    },
  };
}

function matchesQuery(
  rfq: RequestForQuoteEntity,
  query: RfqListQuery,
): boolean {
  return (
    (query.status === undefined || rfq.status === query.status) &&
    (query.categoryId === undefined ||
      rfq.items.some((item) => item.categoryId === query.categoryId))
  );
}

function productSummary(product: ProductSeed) {
  return {
    id: product.id,
    sellerId: product.sellerId,
    categoryId: product.categoryId,
    name: product.name,
    imageUrl: product.imageUrl,
  };
}

function toCents(value: string): number {
  return Math.round(Number(value) * 100);
}
