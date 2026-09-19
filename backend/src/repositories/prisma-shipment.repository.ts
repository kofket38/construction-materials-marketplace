import {
  ShipmentStatus as PrismaShipmentStatus,
  type Prisma,
  type PrismaClient,
} from "../prisma/generated/client.js";
import {
  OrderNotFoundError,
  ShipmentNotFoundError,
  ShipmentProofAlreadyExistsError,
  ShipmentStateChangedError,
  ShipmentTerminalStatusError,
  type CreateShipmentEventInput,
  type ShipmentEntity,
  type ShipmentEventEntity,
  type ShipmentProofAuthorization,
  type ShipmentProofEntity,
  type ShipmentRepository,
  type ShipmentStatus,
  type UpdateShipmentStatusInput,
} from "./shipment.repository.js";

const shipmentEventActorSelect = {
  id: true,
  name: true,
  email: true,
};

const shipmentProofRelations = {
  actor: shipmentEventActorSelect,
} satisfies Prisma.DeliveryProofInclude;

const shipmentEventRelations = {
  actor: shipmentEventActorSelect,
} satisfies Prisma.ShipmentEventInclude;

const shipmentItemRelations = {
  product: {
    select: {
      id: true,
      sellerId: true,
      name: true,
      imageUrl: true,
    },
  },
} satisfies Prisma.OrderItemInclude;

const shipmentRelations = {
  order: {
    select: {
      id: true,
      customerId: true,
      status: true,
      totalAmount: true,
      shippingAddress: true,
      items: {
        include: shipmentItemRelations,
        orderBy: { id: "asc" },
      },
    },
  },
  proof: { include: shipmentProofRelations },
  events: {
    include: shipmentEventRelations,
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.ShipmentInclude;

type ShipmentWithRelations = Prisma.ShipmentGetPayload<{
  include: typeof shipmentRelations;
}>;

type ShipmentProofPayload = Prisma.DeliveryProofGetPayload<{
  include: typeof shipmentProofRelations;
}>;

type ShipmentEventPayload = Prisma.ShipmentEventGetPayload<{
  include: typeof shipmentEventRelations;
}>;

function mapShipmentStatus(status: ShipmentStatus): PrismaShipmentStatus {
  switch (status) {
    case "CREATED":
      return PrismaShipmentStatus.CREATED;
    case "PROCESSING":
      return PrismaShipmentStatus.PROCESSING;
    case "DISPATCHED":
      return PrismaShipmentStatus.DISPATCHED;
    case "IN_TRANSIT":
      return PrismaShipmentStatus.IN_TRANSIT;
    case "DELIVERED":
      return PrismaShipmentStatus.DELIVERED;
    case "CANCELLED":
      return PrismaShipmentStatus.CANCELLED;
  }
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

/**
 * Build the `actor` connect payload for a create call. With
 * exactOptionalPropertyTypes, the property must be omitted (not set to
 * undefined) when there is no actor.
 */
function actorConnect(
  actorId?: string | null,
): { actor: { connect: { id: string } } } | undefined {
  return actorId ? { actor: { connect: { id: actorId } } } : undefined;
}

export class PrismaShipmentRepository implements ShipmentRepository {
  constructor(private readonly client: PrismaClient) {}

  async create(orderId: string): Promise<ShipmentEntity> {
    const trackingCode = generateTrackingCode();
    let attempt = 0;

    // The tracking code is server-generated and must be unique. On the rare
    // collision, regenerate and retry (up to a bounded number of attempts).
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const shipment = await this.client.shipment.create({
          data: {
            order: { connect: { id: orderId } },
            trackingCode,
          },
          include: shipmentRelations,
        });
        return mapShipment(shipment);
      } catch (error) {
        if (hasPrismaCode(error, "P2002")) {
          if (attempt < 5) {
            attempt++;
            // Retry with a fresh code by recursing through a new variable.
            return this.create(orderId);
          }
          throw error;
        }
        if (hasPrismaCode(error, "P2025")) {
          throw new OrderNotFoundError(orderId);
        }
        throw error;
      }
    }
  }

  async findById(id: string): Promise<ShipmentEntity | null> {
    const shipment = await this.client.shipment.findUnique({
      where: { id },
      include: shipmentRelations,
    });
    return shipment ? mapShipment(shipment) : null;
  }

  async findByOrderId(orderId: string): Promise<ShipmentEntity | null> {
    const shipment = await this.client.shipment.findUnique({
      where: { orderId },
      include: shipmentRelations,
    });
    return shipment ? mapShipment(shipment) : null;
  }

  async findByTrackingCode(
    trackingCode: string,
  ): Promise<ShipmentEntity | null> {
    const shipment = await this.client.shipment.findUnique({
      where: { trackingCode },
      include: shipmentRelations,
    });
    return shipment ? mapShipment(shipment) : null;
  }

  async findByCustomerId(customerId: string): Promise<ShipmentEntity[]> {
    const shipments = await this.client.shipment.findMany({
      where: { order: { customerId } },
      include: shipmentRelations,
      orderBy: { createdAt: "desc" },
    });
    return shipments.map(mapShipment);
  }

  async findBySellerId(sellerId: string): Promise<ShipmentEntity[]> {
    const shipments = await this.client.shipment.findMany({
      where: {
        order: {
          items: { some: { product: { sellerId } } },
        },
      },
      include: shipmentRelations,
      orderBy: { createdAt: "desc" },
    });
    return shipments.map(mapShipment);
  }

  async addEvent(
    shipmentId: string,
    input: CreateShipmentEventInput,
  ): Promise<ShipmentEventEntity> {
    try {
      const event = await this.client.shipmentEvent.create({
        data: {
          shipment: { connect: { id: shipmentId } },
          status: mapShipmentStatus(input.status),
          metadata: input.metadata ?? undefined,
          ...actorConnect(input.actorId),
        },
        include: shipmentEventRelations,
      });
      return mapShipmentEvent(event);
    } catch (error) {
      if (hasPrismaCode(error, "P2025")) {
        throw new ShipmentNotFoundError(shipmentId);
      }
      throw error;
    }
  }

  async updateStatus(
    shipmentId: string,
    input: UpdateShipmentStatusInput,
  ): Promise<ShipmentEntity | null> {
    return this.client.$transaction(async (transaction) => {
      const current = await transaction.shipment.findUnique({
        where: { id: shipmentId },
        select: { status: true },
      });

      if (!current) {
        return null;
      }
      if (
        current.status === PrismaShipmentStatus.CANCELLED ||
        current.status === PrismaShipmentStatus.DELIVERED
      ) {
        throw new ShipmentTerminalStatusError();
      }

      const update = await transaction.shipment.updateMany({
        where: { id: shipmentId, status: current.status },
        data: { status: mapShipmentStatus(input.status) },
      });

      if (update.count !== 1) {
        throw new ShipmentStateChangedError();
      }

      await transaction.shipmentEvent.create({
        data: {
          shipmentId,
          status: mapShipmentStatus(input.status),
          metadata: input.metadata ?? undefined,
          ...actorConnect(input.actorId),
        },
      });

      const updated = await transaction.shipment.findUnique({
        where: { id: shipmentId },
        include: shipmentRelations,
      });
      return updated ? mapShipment(updated) : null;
    }, { timeout: 30_000, maxWait: 10_000 });
  }

  async createProof(
    shipmentId: string,
    input: {
      fileReference: string;
      contentType: string;
      actorId?: string | null;
    },
  ): Promise<ShipmentProofEntity> {
    try {
      const proof = await this.client.deliveryProof.create({
        data: {
          shipment: { connect: { id: shipmentId } },
          fileReference: input.fileReference,
          contentType: input.contentType,
          capturedAt: new Date(),
          ...actorConnect(input.actorId),
        },
        include: shipmentProofRelations,
      });
      return mapShipmentProof(proof);
    } catch (error) {
      if (hasPrismaCode(error, "P2002")) {
        throw new ShipmentProofAlreadyExistsError();
      }
      if (hasPrismaCode(error, "P2025")) {
        throw new ShipmentNotFoundError(shipmentId);
      }
      throw error;
    }
  }

  async findProofByFileReference(
    fileReference: string,
  ): Promise<ShipmentProofAuthorization | null> {
    const proof = await this.client.deliveryProof.findFirst({
      where: { fileReference },
      select: {
        fileReference: true,
        shipmentId: true,
        shipment: {
          select: {
            orderId: true,
            order: {
              select: {
                customerId: true,
                items: {
                  select: {
                    product: { select: { sellerId: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!proof || !proof.shipment) {
      return null;
    }

    const sellerIds = [
      ...new Set(
        proof.shipment.order.items.map((item) => item.product.sellerId),
      ),
    ];

    return {
      fileReference: proof.fileReference,
      shipmentId: proof.shipmentId,
      orderId: proof.shipment.orderId,
      customerId: proof.shipment.order.customerId,
      sellerIds,
    };
  }
}

/**
 * Generate a human-readable, server-side tracking code.
 *
 * Format: SHIP-<YYMMDD>-<8 alphanumeric>
 * Guarantees: server-generated, unique (enforced by DB + retry), stable for the
 * shipment lifetime, and contains no client-supplied input.
 */
function generateTrackingCode(): string {
  const date = new Date();
  const yymmdd =
    String(date.getUTCFullYear()).slice(-2) +
    String(date.getUTCMonth() + 1).padStart(2, "0") +
    String(date.getUTCDate()).padStart(2, "0");

  const random = Math.random()
    .toString(36)
    .slice(2, 10)
    .toUpperCase()
    .padStart(8, "0");

  return `SHIP-${yymmdd}-${random}`;
}

function mapShipment(shipment: ShipmentWithRelations): ShipmentEntity {
  return {
    id: shipment.id,
    orderId: shipment.orderId,
    trackingCode: shipment.trackingCode,
    status: shipment.status as ShipmentStatus,
    order: {
      id: shipment.order.id,
      customerId: shipment.order.customerId,
      status: shipment.order.status,
      totalAmount: shipment.order.totalAmount.toFixed(2),
      shippingAddress: shipment.order.shippingAddress,
      items: shipment.order.items.map((item) => ({
        id: item.id,
        orderId: item.orderId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(2),
        subtotal: item.subtotal.toFixed(2),
        price: item.price.toFixed(2),
        product: item.product,
      })),
    },
    proof: shipment.proof ? mapShipmentProof(shipment.proof) : null,
    events: shipment.events.map(mapShipmentEvent),
    createdAt: shipment.createdAt,
    updatedAt: shipment.updatedAt,
  };
}

function mapShipmentProof(proof: ShipmentProofPayload): ShipmentProofEntity {
  return {
    id: proof.id,
    shipmentId: proof.shipmentId,
    fileReference: proof.fileReference,
    contentType: proof.contentType,
    capturedAt: proof.capturedAt,
    actorId: proof.actorId,
    createdAt: proof.createdAt,
    updatedAt: proof.updatedAt,
  };
}

function mapShipmentEvent(event: ShipmentEventPayload): ShipmentEventEntity {
  return {
    id: event.id,
    shipmentId: event.shipmentId,
    status: event.status as ShipmentStatus,
    metadata: event.metadata as Record<string, unknown> | null,
    actorId: event.actorId,
    actor: event.actor
      ? { id: event.actor.id, name: event.actor.name, email: event.actor.email }
      : null,
    createdAt: event.createdAt,
  };
}
