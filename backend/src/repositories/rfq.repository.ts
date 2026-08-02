import type { OrderEntity } from "./order.repository.js";

export type RfqStatus =
  | "OPEN"
  | "AWARDED"
  | "CANCELLED"
  | "EXPIRED";

export type SupplierQuoteStatus =
  | "SUBMITTED"
  | "ACCEPTED"
  | "REJECTED"
  | "WITHDRAWN"
  | "CLOSED";

export type RfqUnit =
  | "BAG"
  | "KG"
  | "TONNE"
  | "LITRE"
  | "METRE"
  | "SQUARE_METRE"
  | "CUBIC_METRE"
  | "PIECE"
  | "ROLL"
  | "PALLET"
  | "LOAD"
  | "OTHER";

export interface RfqCustomerSummary {
  id: string;
  name: string;
  company: string | null;
}

export interface RfqSellerSummary {
  id: string;
  name: string;
  company: string | null;
  shopName: string | null;
}

export interface RfqProductSummary {
  id: string;
  sellerId: string;
  categoryId: string;
  name: string;
  imageUrl: string | null;
}

export interface RfqItemEntity {
  id: string;
  rfqId: string;
  categoryId: string | null;
  preferredProductId: string | null;
  categoryName: string;
  materialName: string;
  specifications: string | null;
  requestedQuantity: string;
  requestedUnit: RfqUnit;
  customUnit: string | null;
  preferredProduct: RfqProductSummary | null;
  createdAt: Date;
}

export interface SupplierQuoteItemEntity {
  id: string;
  quoteId: string;
  rfqItemId: string;
  productId: string | null;
  productName: string;
  offeredQuantity: number;
  unitPrice: string;
  lineTotal: string;
  product: RfqProductSummary | null;
  createdAt: Date;
}

export interface SupplierQuoteEntity {
  id: string;
  rfqId: string;
  sellerId: string;
  status: SupplierQuoteStatus;
  validUntil: Date;
  leadTimeDays: number;
  terms: string | null;
  totalAmount: string;
  orderId: string | null;
  seller: RfqSellerSummary;
  items: SupplierQuoteItemEntity[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RequestForQuoteEntity {
  id: string;
  customerId: string;
  title: string;
  deliveryLocation: string;
  notes: string | null;
  status: RfqStatus;
  expiresAt: Date;
  awardedQuoteId: string | null;
  customer: RfqCustomerSummary;
  items: RfqItemEntity[];
  quotes: SupplierQuoteEntity[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RfqPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface RfqListResult {
  rfqs: RequestForQuoteEntity[];
  pagination: RfqPagination;
}

export interface RfqListQuery {
  page: number;
  limit: number;
  status?: RfqStatus;
  categoryId?: string;
}

export interface SellerRfqListQuery extends RfqListQuery {
  view: "available" | "participating";
}

export interface CreateRfqItemInput {
  categoryId: string;
  preferredProductId?: string;
  materialName: string;
  specifications?: string;
  requestedQuantity: string;
  requestedUnit: RfqUnit;
  customUnit?: string;
}

export interface CreateRfqInput {
  customerId: string;
  title: string;
  deliveryLocation: string;
  notes?: string;
  expiresAt: Date;
  items: CreateRfqItemInput[];
}

export type UpdateRfqInput = Omit<CreateRfqInput, "customerId">;

export interface QuoteItemInput {
  rfqItemId: string;
  productId: string;
  offeredQuantity: number;
  unitPrice: string;
}

export interface CreateSupplierQuoteInput {
  rfqId: string;
  sellerId: string;
  validUntil: Date;
  leadTimeDays: number;
  terms?: string;
  items: QuoteItemInput[];
}

export type UpdateSupplierQuoteInput = Omit<
  CreateSupplierQuoteInput,
  "rfqId" | "sellerId"
>;

export interface AcceptQuoteResult {
  rfq: RequestForQuoteEntity;
  order: OrderEntity;
}

export interface RfqRepository {
  create(input: CreateRfqInput): Promise<RequestForQuoteEntity>;
  findById(id: string): Promise<RequestForQuoteEntity | null>;
  findByIdForSeller(
    id: string,
    sellerId: string,
  ): Promise<RequestForQuoteEntity | null>;
  findByCustomer(
    customerId: string,
    query: RfqListQuery,
  ): Promise<RfqListResult>;
  findForSeller(
    sellerId: string,
    query: SellerRfqListQuery,
  ): Promise<RfqListResult>;
  findForAdmin(query: RfqListQuery): Promise<RfqListResult>;
  isSellerEligible(rfqId: string, sellerId: string): Promise<boolean>;
  update(
    id: string,
    customerId: string,
    input: UpdateRfqInput,
  ): Promise<RequestForQuoteEntity>;
  cancel(
    id: string,
    customerId: string,
  ): Promise<RequestForQuoteEntity>;
  createQuote(
    input: CreateSupplierQuoteInput,
  ): Promise<SupplierQuoteEntity>;
  updateQuote(
    id: string,
    sellerId: string,
    input: UpdateSupplierQuoteInput,
  ): Promise<SupplierQuoteEntity>;
  withdrawQuote(
    id: string,
    sellerId: string,
  ): Promise<SupplierQuoteEntity>;
  rejectQuote(
    id: string,
    customerId: string,
  ): Promise<SupplierQuoteEntity>;
  acceptQuote(
    id: string,
    customerId: string,
  ): Promise<AcceptQuoteResult>;
}
