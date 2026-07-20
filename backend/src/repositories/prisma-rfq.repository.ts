import {
  Prisma,
  type PrismaClient,
} from "../prisma/generated/client.js";
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
  SupplierQuoteCoverageError,
  SupplierQuoteAmountTooLargeError,
  SupplierQuoteCustomerError,
  SupplierQuoteExpiredError,
  SupplierQuoteNotFoundError,
  SupplierQuoteNotSubmittedError,
  SupplierQuoteOwnershipError,
  SupplierQuoteValidityError,
} from "./rfq.errors.js";
import type {
  AcceptQuoteResult,
  CreateRfqInput,
  CreateRfqItemInput,
  CreateSupplierQuoteInput,
  QuoteItemInput,
  RequestForQuoteEntity,
  RfqItemEntity,
  RfqListQuery,
  RfqListResult,
  RfqRepository,
  RfqStatus,
  RfqUnit,
  SellerRfqListQuery,
  SupplierQuoteEntity,
  SupplierQuoteItemEntity,
  SupplierQuoteStatus,
  UpdateRfqInput,
  UpdateSupplierQuoteInput,
} from "./rfq.repository.js";
import type { OrderEntity, OrderStatus } from "./order.repository.js";

const MAX_QUOTE_AMOUNT = new Prisma.Decimal("999999999999.99");

const productSummarySelect = {
  id: true,
  sellerId: true,
  categoryId: true,
  name: true,
  imageUrl: true,
} satisfies Prisma.ProductSelect;

const rfqRelations = {
  customer: {
    select: {
      id: true,
      name: true,
      company: true,
    },
  },
  items: {
    include: {
      preferredProduct: {
        select: productSummarySelect,
      },
    },
    orderBy: {
      id: "asc",
    },
  },
  quotes: {
    include: {
      seller: {
        select: {
          id: true,
          name: true,
          company: true,
          sellerProfile: {
            select: {
              shopName: true,
            },
          },
        },
      },
      items: {
        include: {
          product: {
            select: productSummarySelect,
          },
        },
        orderBy: {
          id: "asc",
        },
      },
    },
    orderBy: [{ createdAt: "desc" as const }, { id: "asc" as const }],
  },
} satisfies Prisma.RequestForQuoteInclude;

const quoteRelations = {
  seller: {
    select: {
      id: true,
      name: true,
      company: true,
      sellerProfile: {
        select: {
          shopName: true,
        },
      },
    },
  },
  items: {
    include: {
      product: {
        select: productSummarySelect,
      },
    },
    orderBy: {
      id: "asc",
    },
  },
} satisfies Prisma.SupplierQuoteInclude;

const orderRelations = {
  customer: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  items: {
    include: {
      product: {
        select: {
          id: true,
          sellerId: true,
          name: true,
          imageUrl: true,
        },
      },
    },
    orderBy: {
      id: "asc",
    },
  },
} satisfies Prisma.OrderInclude;

type RfqWithRelations = Prisma.RequestForQuoteGetPayload<{
  include: typeof rfqRelations;
}>;

type QuoteWithRelations = Prisma.SupplierQuoteGetPayload<{
  include: typeof quoteRelations;
}>;

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof orderRelations;
}>;

type TransactionClient = Parameters<
  Parameters<PrismaClient["$transaction"]>[0]
>[0];

interface RfqItemSnapshot {
  input: CreateRfqItemInput;
  categoryName: string;
}

export class PrismaRfqRepository implements RfqRepository {
  constructor(private readonly client: PrismaClient) {}

  async create(input: CreateRfqInput): Promise<RequestForQuoteEntity> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const items = await this.loadRfqItemSnapshots(
          transaction,
          input.items,
        );
        const rfq = await transaction.requestForQuote.create({
          data: {
            customerId: input.customerId,
            title: input.title,
            deliveryLocation: input.deliveryLocation,
            ...(input.notes !== undefined ? { notes: input.notes } : {}),
            expiresAt: input.expiresAt,
            items: {
              create: items.map(toRfqItemCreateData),
            },
          },
          include: rfqRelations,
        });

        return mapRfq(rfq);
      });
    } catch (error) {
      this.translateWriteError(error);
    }
  }

  async findById(id: string): Promise<RequestForQuoteEntity | null> {
    await this.expireOpenRfqs();
    const rfq = await this.client.requestForQuote.findUnique({
      where: { id },
      include: rfqRelations,
    });
    return rfq ? mapRfq(rfq) : null;
  }

  async findByCustomer(
    customerId: string,
    query: RfqListQuery,
  ): Promise<RfqListResult> {
    await this.expireOpenRfqs();
    return this.findMany({
      query,
      where: {
        customerId,
        ...listFilters(query),
      },
    });
  }

  async findForSeller(
    sellerId: string,
    query: SellerRfqListQuery,
  ): Promise<RfqListResult> {
    await this.expireOpenRfqs();
    const sellerScope: Prisma.RequestForQuoteWhereInput =
      query.view === "participating"
        ? {
            quotes: {
              some: { sellerId },
            },
          }
        : {
            status: "OPEN",
            items: {
              every: {
                category: {
                  is: {
                    products: {
                      some: { sellerId },
                    },
                  },
                },
              },
            },
          };

    return this.findMany({
      query,
      where: {
        AND: [sellerScope, listFilters(query)],
      },
    });
  }

  async findForAdmin(query: RfqListQuery): Promise<RfqListResult> {
    await this.expireOpenRfqs();
    return this.findMany({
      query,
      where: listFilters(query),
    });
  }

  async isSellerEligible(
    rfqId: string,
    sellerId: string,
  ): Promise<boolean> {
    await this.expireOpenRfqs();
    const count = await this.client.requestForQuote.count({
      where: {
        id: rfqId,
        OR: [
          {
            quotes: {
              some: { sellerId },
            },
          },
          {
            status: "OPEN",
            items: {
              every: {
                category: {
                  is: {
                    products: {
                      some: { sellerId },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    });
    return count === 1;
  }

  async update(
    id: string,
    customerId: string,
    input: UpdateRfqInput,
  ): Promise<RequestForQuoteEntity> {
    await this.expireOpenRfqs();
    try {
      return await this.serializable(async (transaction) => {
        await lockRfq(transaction, id);
        const current = await transaction.requestForQuote.findUnique({
          where: { id },
          include: {
            _count: {
              select: { quotes: true },
            },
          },
        });
        this.requireOwnedOpenRfq(current, customerId);
        if (current._count.quotes > 0) {
          throw new RfqHasQuotesError();
        }

        const items = await this.loadRfqItemSnapshots(
          transaction,
          input.items,
        );
        await transaction.rfqItem.deleteMany({ where: { rfqId: id } });
        const updated = await transaction.requestForQuote.update({
          where: { id },
          data: {
            title: input.title,
            deliveryLocation: input.deliveryLocation,
            notes: input.notes ?? null,
            expiresAt: input.expiresAt,
            items: {
              create: items.map(toRfqItemCreateData),
            },
          },
          include: rfqRelations,
        });
        return mapRfq(updated);
      });
    } catch (error) {
      this.translateWriteError(error);
    }
  }

  async cancel(
    id: string,
    customerId: string,
  ): Promise<RequestForQuoteEntity> {
    await this.expireOpenRfqs();
    try {
      return await this.serializable(async (transaction) => {
        await lockRfq(transaction, id);
        const current = await transaction.requestForQuote.findUnique({
          where: { id },
        });
        this.requireOwnedOpenRfq(current, customerId);

        await transaction.supplierQuote.updateMany({
          where: {
            rfqId: id,
            status: "SUBMITTED",
          },
          data: { status: "CLOSED" },
        });
        const cancelled = await transaction.requestForQuote.update({
          where: { id },
          data: { status: "CANCELLED" },
          include: rfqRelations,
        });
        return mapRfq(cancelled);
      });
    } catch (error) {
      this.translateWriteError(error);
    }
  }

  async createQuote(
    input: CreateSupplierQuoteInput,
  ): Promise<SupplierQuoteEntity> {
    await this.expireOpenRfqs();
    try {
      return await this.serializable(async (transaction) => {
        await lockRfq(transaction, input.rfqId);
        const rfq = await transaction.requestForQuote.findUnique({
          where: { id: input.rfqId },
          include: { items: true },
        });
        this.requireOpenRfq(rfq);
        const quoteItems = await this.prepareQuoteItems(
          transaction,
          rfq.items,
          input.sellerId,
          input.items,
        );
        this.requireValidQuoteDates(
          input.validUntil,
          rfq.expiresAt,
        );

        const totalAmount = quoteItems.reduce(
          (total, item) => total.plus(item.lineTotal),
          new Prisma.Decimal(0),
        );
        requireSupportedQuoteAmount(totalAmount);
        const quote = await transaction.supplierQuote.create({
          data: {
            rfqId: input.rfqId,
            sellerId: input.sellerId,
            validUntil: input.validUntil,
            leadTimeDays: input.leadTimeDays,
            ...(input.terms !== undefined ? { terms: input.terms } : {}),
            totalAmount,
            items: {
              create: quoteItems,
            },
          },
          include: quoteRelations,
        });
        return mapQuote(quote);
      });
    } catch (error) {
      if (hasPrismaCode(error, "P2002")) {
        throw new DuplicateSupplierQuoteError();
      }
      this.translateWriteError(error);
    }
  }

  async updateQuote(
    id: string,
    sellerId: string,
    input: UpdateSupplierQuoteInput,
  ): Promise<SupplierQuoteEntity> {
    await this.expireOpenRfqs();
    try {
      return await this.serializable(async (transaction) => {
        const quotePointer = await transaction.supplierQuote.findUnique({
          where: { id },
          select: { rfqId: true },
        });
        if (!quotePointer) {
          throw new SupplierQuoteNotFoundError();
        }
        await lockRfq(transaction, quotePointer.rfqId);
        const quote = await transaction.supplierQuote.findUnique({
          where: { id },
          include: {
            rfq: {
              include: { items: true },
            },
          },
        });
        this.requireOwnedSubmittedQuote(quote, sellerId);
        this.requireOpenRfq(quote.rfq);
        const quoteItems = await this.prepareQuoteItems(
          transaction,
          quote.rfq.items,
          sellerId,
          input.items,
        );
        this.requireValidQuoteDates(
          input.validUntil,
          quote.rfq.expiresAt,
        );
        const totalAmount = quoteItems.reduce(
          (total, item) => total.plus(item.lineTotal),
          new Prisma.Decimal(0),
        );
        requireSupportedQuoteAmount(totalAmount);

        await transaction.supplierQuoteItem.deleteMany({
          where: { quoteId: id },
        });
        const updated = await transaction.supplierQuote.update({
          where: { id },
          data: {
            validUntil: input.validUntil,
            leadTimeDays: input.leadTimeDays,
            terms: input.terms ?? null,
            totalAmount,
            items: {
              create: quoteItems,
            },
          },
          include: quoteRelations,
        });
        return mapQuote(updated);
      });
    } catch (error) {
      this.translateWriteError(error);
    }
  }

  async withdrawQuote(
    id: string,
    sellerId: string,
  ): Promise<SupplierQuoteEntity> {
    await this.expireOpenRfqs();
    try {
      return await this.serializable(async (transaction) => {
        const quotePointer = await transaction.supplierQuote.findUnique({
          where: { id },
          select: { rfqId: true },
        });
        if (!quotePointer) {
          throw new SupplierQuoteNotFoundError();
        }
        await lockRfq(transaction, quotePointer.rfqId);
        const current = await transaction.supplierQuote.findUnique({
          where: { id },
          include: { rfq: true },
        });
        this.requireOwnedSubmittedQuote(current, sellerId);
        this.requireOpenRfq(current.rfq);

        const quote = await transaction.supplierQuote.update({
          where: { id },
          data: { status: "WITHDRAWN" },
          include: quoteRelations,
        });
        return mapQuote(quote);
      });
    } catch (error) {
      this.translateWriteError(error);
    }
  }

  async rejectQuote(
    id: string,
    customerId: string,
  ): Promise<SupplierQuoteEntity> {
    await this.expireOpenRfqs();
    try {
      return await this.serializable(async (transaction) => {
        const quotePointer = await transaction.supplierQuote.findUnique({
          where: { id },
          select: { rfqId: true },
        });
        if (!quotePointer) {
          throw new SupplierQuoteNotFoundError();
        }
        await lockRfq(transaction, quotePointer.rfqId);
        const current = await transaction.supplierQuote.findUnique({
          where: { id },
          include: { rfq: true },
        });
        this.requireCustomerSubmittedQuote(current, customerId);
        this.requireOpenRfq(current.rfq);

        const quote = await transaction.supplierQuote.update({
          where: { id },
          data: { status: "REJECTED" },
          include: quoteRelations,
        });
        return mapQuote(quote);
      });
    } catch (error) {
      this.translateWriteError(error);
    }
  }

  async acceptQuote(
    id: string,
    customerId: string,
  ): Promise<AcceptQuoteResult> {
    await this.expireOpenRfqs();
    try {
      return await this.serializable(async (transaction) => {
        const quotePointer = await transaction.supplierQuote.findUnique({
          where: { id },
          select: { rfqId: true },
        });
        if (!quotePointer) {
          throw new SupplierQuoteNotFoundError();
        }
        await lockRfq(transaction, quotePointer.rfqId);
        const quote = await transaction.supplierQuote.findUnique({
          where: { id },
          include: {
            rfq: {
              include: { items: true },
            },
            items: {
              include: {
                product: {
                  select: productSummarySelect,
                },
              },
            },
          },
        });
        this.requireCustomerSubmittedQuote(quote, customerId);
        this.requireOpenRfq(quote.rfq);
        if (quote.validUntil.getTime() <= Date.now()) {
          throw new SupplierQuoteExpiredError();
        }

        const rfqItems = new Map(
          quote.rfq.items.map((item) => [item.id, item]),
        );
        if (
          quote.items.length !== quote.rfq.items.length ||
          quote.items.some((item) => !rfqItems.has(item.rfqItemId))
        ) {
          throw new RfqStateChangedError();
        }
        let totalAmount = new Prisma.Decimal(0);
        const orderItems: Array<{
          productId: string;
          quantity: number;
          price: Prisma.Decimal;
        }> = [];

        for (const item of quote.items) {
          const product = item.product;
          if (!product || !item.productId) {
            throw new RfqQuotedProductUnavailableError(item.productId);
          }
          const rfqItem = rfqItems.get(item.rfqItemId);
          if (
            !rfqItem ||
            product.sellerId !== quote.sellerId ||
            product.categoryId !== rfqItem.categoryId
          ) {
            throw new RfqQuotedProductUnavailableError(product.id);
          }

          const stockUpdate = await transaction.product.updateMany({
            where: {
              id: product.id,
              sellerId: quote.sellerId,
              categoryId: rfqItem.categoryId ?? undefined,
              quantity: { gte: item.offeredQuantity },
            },
            data: {
              quantity: { decrement: item.offeredQuantity },
            },
          });
          if (stockUpdate.count !== 1) {
            const currentProduct = await transaction.product.findUnique({
              where: { id: product.id },
              select: { id: true },
            });
            if (!currentProduct) {
              throw new RfqQuotedProductUnavailableError(product.id);
            }
            throw new RfqInsufficientStockError(product.id);
          }

          totalAmount = totalAmount.plus(item.unitPrice.mul(item.offeredQuantity));
          orderItems.push({
            productId: product.id,
            quantity: item.offeredQuantity,
            price: item.unitPrice,
          });
        }

        if (!totalAmount.equals(quote.totalAmount)) {
          throw new RfqStateChangedError();
        }

        const order = await transaction.order.create({
          data: {
            customerId,
            totalAmount,
            items: { create: orderItems },
          },
          include: orderRelations,
        });

        await transaction.supplierQuote.update({
          where: { id },
          data: {
            status: "ACCEPTED",
            orderId: order.id,
          },
        });
        await transaction.supplierQuote.updateMany({
          where: {
            rfqId: quote.rfqId,
            id: { not: id },
            status: "SUBMITTED",
          },
          data: { status: "REJECTED" },
        });
        await transaction.requestForQuote.update({
          where: { id: quote.rfqId },
          data: {
            status: "AWARDED",
            awardedQuoteId: id,
          },
        });

        const rfq = await transaction.requestForQuote.findUniqueOrThrow({
          where: { id: quote.rfqId },
          include: rfqRelations,
        });
        return {
          rfq: mapRfq(rfq),
          order: mapOrder(order),
        };
      });
    } catch (error) {
      this.translateWriteError(error);
    }
  }

  private async findMany(input: {
    query: RfqListQuery;
    where: Prisma.RequestForQuoteWhereInput;
  }): Promise<RfqListResult> {
    const [total, rfqs] = await this.client.$transaction([
      this.client.requestForQuote.count({ where: input.where }),
      this.client.requestForQuote.findMany({
        where: input.where,
        include: rfqRelations,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (input.query.page - 1) * input.query.limit,
        take: input.query.limit,
      }),
    ]);
    return {
      rfqs: rfqs.map(mapRfq),
      pagination: {
        page: input.query.page,
        limit: input.query.limit,
        total,
        totalPages: Math.ceil(total / input.query.limit),
      },
    };
  }

  private async expireOpenRfqs(): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const expired = await transaction.requestForQuote.findMany({
        where: {
          status: "OPEN",
          expiresAt: { lte: new Date() },
        },
        select: { id: true },
      });
      if (expired.length === 0) {
        return;
      }
      const ids = expired.map((rfq) => rfq.id);
      await transaction.supplierQuote.updateMany({
        where: {
          rfqId: { in: ids },
          status: "SUBMITTED",
        },
        data: { status: "CLOSED" },
      });
      await transaction.requestForQuote.updateMany({
        where: {
          id: { in: ids },
          status: "OPEN",
        },
        data: { status: "EXPIRED" },
      });
    });
  }

  private async loadRfqItemSnapshots(
    transaction: TransactionClient,
    items: CreateRfqItemInput[],
  ): Promise<RfqItemSnapshot[]> {
    const categoryIds = [...new Set(items.map((item) => item.categoryId))];
    const categories = await transaction.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });
    const categoryNames = new Map(
      categories.map((category) => [category.id, category.name]),
    );
    for (const categoryId of categoryIds) {
      if (!categoryNames.has(categoryId)) {
        throw new RfqCategoryNotFoundError(categoryId);
      }
    }

    const preferredProductIds = [
      ...new Set(
        items.flatMap((item) =>
          item.preferredProductId ? [item.preferredProductId] : [],
        ),
      ),
    ];
    const preferredProducts =
      preferredProductIds.length === 0
        ? []
        : await transaction.product.findMany({
            where: { id: { in: preferredProductIds } },
            select: { id: true, categoryId: true },
          });
    const productsById = new Map(
      preferredProducts.map((product) => [product.id, product]),
    );

    return items.map((item) => {
      if (item.preferredProductId) {
        const product = productsById.get(item.preferredProductId);
        if (!product) {
          throw new RfqPreferredProductNotFoundError(
            item.preferredProductId,
          );
        }
        if (product.categoryId !== item.categoryId) {
          throw new RfqPreferredProductCategoryError();
        }
      }
      return {
        input: item,
        categoryName: categoryNames.get(item.categoryId) as string,
      };
    });
  }

  private async prepareQuoteItems(
    transaction: TransactionClient,
    rfqItems: Array<{ id: string; categoryId: string | null }>,
    sellerId: string,
    items: QuoteItemInput[],
  ) {
    const requestedItemIds = new Set(rfqItems.map((item) => item.id));
    const suppliedItemIds = new Set(items.map((item) => item.rfqItemId));
    if (
      items.length !== rfqItems.length ||
      requestedItemIds.size !== suppliedItemIds.size ||
      [...requestedItemIds].some((id) => !suppliedItemIds.has(id))
    ) {
      throw new SupplierQuoteCoverageError();
    }

    const products = await transaction.product.findMany({
      where: {
        id: { in: items.map((item) => item.productId) },
      },
      select: productSummarySelect,
    });
    const productsById = new Map(
      products.map((product) => [product.id, product]),
    );
    const rfqItemsById = new Map(rfqItems.map((item) => [item.id, item]));

    return items.map((item) => {
      const product = productsById.get(item.productId);
      if (!product) {
        throw new QuotedProductNotFoundError(item.productId);
      }
      if (product.sellerId !== sellerId) {
        throw new QuotedProductOwnershipError();
      }
      const rfqItem = rfqItemsById.get(item.rfqItemId);
      if (!rfqItem || product.categoryId !== rfqItem.categoryId) {
        throw new QuotedProductCategoryError();
      }
      const unitPrice = new Prisma.Decimal(item.unitPrice);
      const lineTotal = unitPrice.mul(item.offeredQuantity);
      requireSupportedQuoteAmount(lineTotal);
      return {
        rfqItemId: item.rfqItemId,
        productId: item.productId,
        productName: product.name,
        offeredQuantity: item.offeredQuantity,
        unitPrice,
        lineTotal,
      };
    });
  }

  private requireOwnedOpenRfq(
    rfq:
      | {
          customerId: string;
          status: RfqStatus;
          expiresAt: Date;
        }
      | null,
    customerId: string,
  ): asserts rfq is {
    customerId: string;
    status: RfqStatus;
    expiresAt: Date;
  } {
    this.requireOpenRfq(rfq);
    if (rfq.customerId !== customerId) {
      throw new RfqOwnershipError();
    }
  }

  private requireOpenRfq<T extends {
    status: RfqStatus;
    expiresAt: Date;
  }>(rfq: T | null): asserts rfq is T {
    if (!rfq) {
      throw new RfqNotFoundError();
    }
    if (rfq.status === "EXPIRED" || rfq.expiresAt.getTime() <= Date.now()) {
      throw new RfqExpiredError();
    }
    if (rfq.status !== "OPEN") {
      throw new RfqNotOpenError();
    }
  }

  private requireOwnedSubmittedQuote<
    T extends {
      sellerId: string;
      status: SupplierQuoteStatus;
    },
  >(quote: T | null, sellerId: string): asserts quote is T {
    if (!quote) {
      throw new SupplierQuoteNotFoundError();
    }
    if (quote.sellerId !== sellerId) {
      throw new SupplierQuoteOwnershipError();
    }
    if (quote.status !== "SUBMITTED") {
      throw new SupplierQuoteNotSubmittedError();
    }
  }

  private requireCustomerSubmittedQuote<
    T extends {
      status: SupplierQuoteStatus;
      rfq: { customerId: string };
    },
  >(quote: T | null, customerId: string): asserts quote is T {
    if (!quote) {
      throw new SupplierQuoteNotFoundError();
    }
    if (quote.rfq.customerId !== customerId) {
      throw new SupplierQuoteCustomerError();
    }
    if (quote.status !== "SUBMITTED") {
      throw new SupplierQuoteNotSubmittedError();
    }
  }

  private requireValidQuoteDates(
    validUntil: Date,
    rfqExpiresAt: Date,
  ): void {
    if (
      validUntil.getTime() <= Date.now() ||
      validUntil.getTime() > rfqExpiresAt.getTime()
    ) {
      throw new SupplierQuoteValidityError();
    }
  }

  private serializable<T>(
    operation: (transaction: TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.client.$transaction(operation, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  private translateWriteError(error: unknown): never {
    if (
      hasPrismaCode(error, "P2002") ||
      hasPrismaCode(error, "P2025") ||
      hasPrismaCode(error, "P2034")
    ) {
      throw new RfqStateChangedError();
    }
    if (hasPrismaCode(error, "P2003")) {
      throw new RfqStateChangedError();
    }
    throw error;
  }
}

function requireSupportedQuoteAmount(amount: Prisma.Decimal): void {
  if (amount.greaterThan(MAX_QUOTE_AMOUNT)) {
    throw new SupplierQuoteAmountTooLargeError();
  }
}

function toRfqItemCreateData(snapshot: RfqItemSnapshot) {
  return {
    categoryId: snapshot.input.categoryId,
    ...(snapshot.input.preferredProductId !== undefined
      ? { preferredProductId: snapshot.input.preferredProductId }
      : {}),
    categoryName: snapshot.categoryName,
    materialName: snapshot.input.materialName,
    ...(snapshot.input.specifications !== undefined
      ? { specifications: snapshot.input.specifications }
      : {}),
    requestedQuantity: new Prisma.Decimal(
      snapshot.input.requestedQuantity,
    ),
    requestedUnit: snapshot.input.requestedUnit,
    ...(snapshot.input.customUnit !== undefined
      ? { customUnit: snapshot.input.customUnit }
      : {}),
  };
}

function listFilters(
  query: RfqListQuery,
): Prisma.RequestForQuoteWhereInput {
  return {
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.categoryId !== undefined
      ? {
          items: {
            some: { categoryId: query.categoryId },
          },
        }
      : {}),
  };
}

async function lockRfq(
  transaction: TransactionClient,
  rfqId: string,
): Promise<void> {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      SELECT "id"
      FROM "request_for_quotes"
      WHERE "id" = ${rfqId}::uuid
      FOR UPDATE
    `,
  );
  if (rows.length === 0) {
    throw new RfqNotFoundError();
  }
}

function mapRfq(rfq: RfqWithRelations): RequestForQuoteEntity {
  return {
    id: rfq.id,
    customerId: rfq.customerId,
    title: rfq.title,
    deliveryLocation: rfq.deliveryLocation,
    notes: rfq.notes,
    status: rfq.status as RfqStatus,
    expiresAt: rfq.expiresAt,
    awardedQuoteId: rfq.awardedQuoteId,
    customer: rfq.customer,
    items: rfq.items.map(mapRfqItem),
    quotes: rfq.quotes.map(mapQuote),
    createdAt: rfq.createdAt,
    updatedAt: rfq.updatedAt,
  };
}

function mapRfqItem(
  item: RfqWithRelations["items"][number],
): RfqItemEntity {
  return {
    id: item.id,
    rfqId: item.rfqId,
    categoryId: item.categoryId,
    preferredProductId: item.preferredProductId,
    categoryName: item.categoryName,
    materialName: item.materialName,
    specifications: item.specifications,
    requestedQuantity: item.requestedQuantity.toFixed(3),
    requestedUnit: item.requestedUnit as RfqUnit,
    customUnit: item.customUnit,
    preferredProduct: item.preferredProduct,
    createdAt: item.createdAt,
  };
}

function mapQuote(quote: QuoteWithRelations): SupplierQuoteEntity {
  return {
    id: quote.id,
    rfqId: quote.rfqId,
    sellerId: quote.sellerId,
    status: quote.status as SupplierQuoteStatus,
    validUntil: quote.validUntil,
    leadTimeDays: quote.leadTimeDays,
    terms: quote.terms,
    totalAmount: quote.totalAmount.toFixed(2),
    orderId: quote.orderId,
    seller: {
      id: quote.seller.id,
      name: quote.seller.name,
      company: quote.seller.company,
      shopName: quote.seller.sellerProfile?.shopName ?? null,
    },
    items: quote.items.map(mapQuoteItem),
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
  };
}

function mapQuoteItem(
  item: QuoteWithRelations["items"][number],
): SupplierQuoteItemEntity {
  return {
    id: item.id,
    quoteId: item.quoteId,
    rfqItemId: item.rfqItemId,
    productId: item.productId,
    productName: item.productName,
    offeredQuantity: item.offeredQuantity,
    unitPrice: item.unitPrice.toFixed(2),
    lineTotal: item.lineTotal.toFixed(2),
    product: item.product,
    createdAt: item.createdAt,
  };
}

function mapOrder(order: OrderWithRelations): OrderEntity {
  return {
    id: order.id,
    customerId: order.customerId,
    status: order.status as OrderStatus,
    totalAmount: order.totalAmount.toFixed(2),
    customer: order.customer,
    items: order.items.map((item) => ({
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      quantity: item.quantity,
      price: item.price.toFixed(2),
      product: item.product,
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}
