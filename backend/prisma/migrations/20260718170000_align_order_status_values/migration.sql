-- Preserve existing orders before removing the legacy status value.
UPDATE "orders"
SET "status" = 'CONFIRMED'
WHERE "status" = 'PROCESSING';

ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;

CREATE TYPE "OrderStatus_new" AS ENUM (
    'PENDING',
    'CONFIRMED',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED'
);

ALTER TABLE "orders"
ALTER COLUMN "status" TYPE "OrderStatus_new"
USING ("status"::text::"OrderStatus_new");

ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "OrderStatus_old";

ALTER TABLE "orders"
ALTER COLUMN "status" SET DEFAULT 'PENDING';
