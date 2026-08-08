CREATE TYPE "InventoryTransactionType" AS ENUM (
    'ORDER_SHIPMENT',
    'ORDER_CANCELLATION'
);

CREATE TABLE "inventory_transactions" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "type" "InventoryTransactionType" NOT NULL,
    "quantityChange" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inventory_transactions_orderId_productId_type_key"
ON "inventory_transactions"("orderId", "productId", "type");

CREATE INDEX "inventory_transactions_productId_createdAt_idx"
ON "inventory_transactions"("productId", "createdAt");

CREATE INDEX "inventory_transactions_orderId_idx"
ON "inventory_transactions"("orderId");

ALTER TABLE "inventory_transactions"
ADD CONSTRAINT "inventory_transactions_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "products"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_transactions"
ADD CONSTRAINT "inventory_transactions_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "orders"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Orders created before this migration already reduced product stock at
-- checkout. Mark those deductions so shipment and cancellation remain
-- idempotent after inventory deduction moves to the SHIPPED transition.
INSERT INTO "inventory_transactions" (
    "id",
    "productId",
    "orderId",
    "type",
    "quantityChange",
    "createdAt"
)
SELECT
    gen_random_uuid(),
    order_items."productId",
    order_items."orderId",
    'ORDER_SHIPMENT'::"InventoryTransactionType",
    -order_items."quantity",
    orders."createdAt"
FROM "order_items"
INNER JOIN "orders" ON orders."id" = order_items."orderId"
WHERE orders."status" <> 'CANCELLED';
