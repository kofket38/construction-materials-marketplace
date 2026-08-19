export type RfqStatus = "OPEN" | "AWARDED" | "CANCELLED" | "EXPIRED";

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

export const RFQ_UNIT_LABELS: Record<RfqUnit, string> = {
  BAG: "Bag",
  KG: "Kilogram",
  TONNE: "Tonne",
  LITRE: "Litre",
  METRE: "Metre",
  SQUARE_METRE: "Square Metre",
  CUBIC_METRE: "Cubic Metre",
  PIECE: "Piece",
  ROLL: "Roll",
  PALLET: "Pallet",
  LOAD: "Load",
  OTHER: "Other",
};

export const RFQ_UNITS: RfqUnit[] = [
  "BAG",
  "KG",
  "TONNE",
  "LITRE",
  "METRE",
  "SQUARE_METRE",
  "CUBIC_METRE",
  "PIECE",
  "ROLL",
  "PALLET",
  "LOAD",
  "OTHER",
];

export interface RfqCustomer {
  id: string;
  name: string;
  company: string | null;
}

export interface RfqSeller {
  id: string;
  name: string;
  company: string | null;
  shopName: string | null;
}

export interface RfqProduct {
  id: string;
  sellerId: string;
  categoryId: string;
  name: string;
  imageUrl: string | null;
}

export interface RfqItem {
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
  preferredProduct: RfqProduct | null;
  createdAt: string;
}

export interface SupplierQuoteItem {
  id: string;
  quoteId: string;
  rfqItemId: string;
  productId: string | null;
  productName: string;
  offeredQuantity: number;
  unitPrice: string;
  lineTotal: string;
  product: RfqProduct | null;
  createdAt: string;
}

export interface SupplierQuote {
  id: string;
  rfqId: string;
  sellerId: string;
  status: SupplierQuoteStatus;
  validUntil: string;
  leadTimeDays: number;
  terms: string | null;
  totalAmount: string;
  orderId: string | null;
  seller: RfqSeller;
  items: SupplierQuoteItem[];
  createdAt: string;
  updatedAt: string;
}

export interface RequestForQuote {
  id: string;
  customerId: string;
  title: string;
  deliveryLocation: string;
  notes: string | null;
  status: RfqStatus;
  expiresAt: string;
  awardedQuoteId: string | null;
  customer: RfqCustomer;
  items: RfqItem[];
  quotes: SupplierQuote[];
  createdAt: string;
  updatedAt: string;
}

export interface RfqPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface RfqListResult {
  rfqs: RequestForQuote[];
  pagination: RfqPagination;
}

// ── Form inputs ───────────────────────────────────────────────────────────────

export interface RfqItemInput {
  categoryId: string;
  preferredProductId?: string;
  materialName: string;
  specifications?: string;
  requestedQuantity: string;
  requestedUnit: RfqUnit;
  customUnit?: string;
}

export interface CreateRfqInput {
  title: string;
  deliveryLocation: string;
  notes?: string;
  expiresAt: string;
  items: RfqItemInput[];
}

export interface QuoteItemInput {
  rfqItemId: string;
  productId: string;
  offeredQuantity: number;
  unitPrice: string;
}

export interface CreateQuoteInput {
  validUntil: string;
  leadTimeDays: number;
  terms?: string;
  items: QuoteItemInput[];
}

export type UpdateQuoteInput = CreateQuoteInput;
