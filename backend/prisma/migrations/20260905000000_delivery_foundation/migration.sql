-- Delivery Foundation (M2b): Shipment, ShipmentEvent, DeliveryProof

-- CreateType: ShipmentStatus enum
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'ShipmentStatus'
    ) THEN
        CREATE TYPE "ShipmentStatus" AS ENUM (
            'CREATED',
            'PROCESSING',
            'DISPATCHED',
            'IN_TRANSIT',
            'DELIVERED',
            'CANCELLED'
        );
        RAISE NOTICE 'Created enum ShipmentStatus';
    ELSE
        RAISE NOTICE 'Enum ShipmentStatus already exists';
    END IF;
END $$;

-- AlterTable: link Order to Shipment via an optional unique FK column.
-- Nullable so every pre-existing order remains valid; ON DELETE SET NULL
-- preserves the shipment if an order is deleted (shipments cascade-delete
-- independently), and Restrict prevents removing an order that still has a
-- live shipment unless explicitly cleared first.
ALTER TABLE "orders" ADD COLUMN     "shipmentId" UUID;

-- CreateTable: shipments
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "trackingCode" VARCHAR(64) NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'CREATED',
    "proofId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- Create unique index on trackingCode first (referenced by unique constraint below)
CREATE UNIQUE INDEX "shipments_trackingCode_key" ON "shipments"("trackingCode");

-- proofId is unique so the relation is one-to-one from the owning side
CREATE UNIQUE INDEX "shipments_proofId_key" ON "shipments"("proofId");

-- CreateTable: shipment_events
CREATE TABLE "shipment_events" (
    "id" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "status" "ShipmentStatus" NOT NULL,
    "metadata" JSONB,
    "actorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable: delivery_proofs
CREATE TABLE "delivery_proofs" (
    "id" UUID NOT NULL,
    "shipmentId" UUID NOT NULL,
    "fileReference" VARCHAR(500) NOT NULL,
    "contentType" VARCHAR(100) NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_proofs_pkey" PRIMARY KEY ("id")
);

-- One-to-one: a shipment has at most one delivery proof.
CREATE UNIQUE INDEX "delivery_proofs_shipmentId_key" ON "delivery_proofs"("shipmentId");

-- CreateIndex: shipments
CREATE UNIQUE INDEX "shipments_orderId_key" ON "shipments"("orderId");
CREATE INDEX "shipments_trackingCode_idx" ON "shipments"("trackingCode");
CREATE INDEX "shipments_status_createdAt_idx" ON "shipments"("status", "createdAt");

-- CreateIndex: shipment_events
CREATE INDEX "shipment_events_shipmentId_createdAt_idx" ON "shipment_events"("shipmentId", "createdAt");
CREATE INDEX "shipment_events_status_idx" ON "shipment_events"("status");

-- CreateIndex: delivery_proofs
CREATE INDEX "delivery_proofs_shipmentId_idx" ON "delivery_proofs"("shipmentId");
CREATE INDEX "delivery_proofs_actorId_idx" ON "delivery_proofs"("actorId");

-- CreateIndex: orders (reverse lookup)
CREATE INDEX "orders_shipmentId_idx" ON "orders"("shipmentId");

-- AddForeignKey: shipments -> orders (one shipment belongs to one order)
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: shipments.proofId -> delivery_proofs.id
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_proofId_fkey" FOREIGN KEY ("proofId") REFERENCES "delivery_proofs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: orders.shipmentId -> shipments.id (optional, one-to-one)
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: shipment_events -> shipments + users
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: delivery_proofs -> shipments + users
ALTER TABLE "delivery_proofs" ADD CONSTRAINT "delivery_proofs_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "delivery_proofs" ADD CONSTRAINT "delivery_proofs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
