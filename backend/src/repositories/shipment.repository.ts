export type ShipmentStatus =
  | "CREATED"
  | "PROCESSING"
  | "DISPATCHED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";

export interface ShipmentActorSummary {
  id: string;
  name: string;
  email: string;
}

export interface ShipmentItemProductSummary {
  id: string;
  sellerId: string;
  name: string;
  imageUrl: string | null;
}

export interface ShipmentItemEntity {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  price: string;
  product: ShipmentItemProductSummary;
}

export interface ShipmentOrderSummary {
  id: string;
  customerId: string;
  status: string;
  totalAmount: string;
  shippingAddress: string;
  items: ShipmentItemEntity[];
}

export interface ShipmentProofEntity {
  id: string;
  shipmentId: string;
  fileReference: string;
  contentType: string;
  capturedAt: Date;
  actorId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShipmentEntity {
  id: string;
  orderId: string;
  trackingCode: string;
  status: ShipmentStatus;
  order: ShipmentOrderSummary;
  proof: ShipmentProofEntity | null;
  events: ShipmentEventEntity[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ShipmentEventEntity {
  id: string;
  shipmentId: string;
  status: ShipmentStatus;
  metadata: Record<string, unknown> | null;
  actorId: string | null;
  actor: ShipmentActorSummary | null;
  createdAt: Date;
}

export interface CreateShipmentInput {
  orderId: string;
}

export interface UpdateShipmentStatusInput {
  status: ShipmentStatus;
  metadata?: Record<string, unknown>;
  actorId: string;
}

export interface CreateShipmentEventInput {
  shipmentId: string;
  status: ShipmentStatus;
  metadata?: Record<string, unknown>;
  actorId?: string | null;
}

export interface CreateDeliveryProofInput {
  shipmentId: string;
  fileReference: string;
  contentType: string;
  actorId?: string | null;
}

export interface ShipmentProofAuthorization {
  fileReference: string;
  shipmentId: string;
  orderId: string;
  customerId: string;
  sellerIds: string[];
}

export interface ShipmentRepository {
  create(input: CreateShipmentInput): Promise<ShipmentEntity>;
  findById(id: string): Promise<ShipmentEntity | null>;
  findByOrderId(orderId: string): Promise<ShipmentEntity | null>;
  findByTrackingCode(trackingCode: string): Promise<ShipmentEntity | null>;
  /**
   * Persists a new event row against the shipment and returns the updated
   * shipment with its events reloaded. Used internally by status transitions.
   */
  addEvent(
    shipmentId: string,
    input: CreateShipmentEventInput,
  ): Promise<ShipmentEventEntity>;
  /** Server-side status transition with a recorded event + actor. */
  updateStatus(
    shipmentId: string,
    input: UpdateShipmentStatusInput,
  ): Promise<ShipmentEntity | null>;
  /** Persist a delivery proof (one-to-one per shipment). */
  createProof(
    shipmentId: string,
    input: CreateDeliveryProofInput,
  ): Promise<ShipmentProofEntity>;
  /** Minimal projection for the authenticated proof-serving endpoint. */
  findProofByFileReference(
    fileReference: string,
  ): Promise<ShipmentProofAuthorization | null>;
  /** Buyer-only projection: shipments for a customer's orders. */
  findByCustomerId(
    customerId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<ShipmentEntity[]>;
  /** Seller-scoped: shipments whose order items reference the seller. */
  findBySellerId(
    sellerId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<ShipmentEntity[]>;
}

/** Errors surfaced to the service layer for domain-level decisions. */
export class ShipmentNotFoundError extends Error {
  constructor(shipmentId: string) {
    super(`Shipment ${shipmentId} was not found.`);
    this.name = "ShipmentNotFoundError";
  }
}

export class OrderNotFoundError extends Error {
  constructor(orderId: string) {
    super(`Order ${orderId} was not found.`);
    this.name = "OrderNotFoundError";
  }
}

export class TrackingCodeConflictError extends Error {
  constructor(trackingCode: string) {
    super(`Tracking code ${trackingCode} is already in use.`);
    this.name = "TrackingCodeConflictError";
  }
}

export class ShipmentStateChangedError extends Error {
  constructor() {
    super("The shipment changed while the request was being processed.");
    this.name = "ShipmentStateChangedError";
  }
}

export class ShipmentTerminalStatusError extends Error {
  constructor() {
    super("A delivered, completed, or cancelled shipment cannot change status.");
    this.name = "ShipmentTerminalStatusError";
  }
}

/**
 * Raised when the order backing a shipment is in a state that does not permit
 * shipment creation or a status transition (e.g. CANCELLED or COMPLETED order).
 */
export class ShipmentOrderStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShipmentOrderStateError";
  }
}

/**
 * Raised when a proof is attached to a shipment that already has one.
 */
export class ShipmentProofAlreadyExistsError extends Error {
  constructor() {
    super("A delivery proof already exists for this shipment.");
    this.name = "ShipmentProofAlreadyExistsError";
  }
}
