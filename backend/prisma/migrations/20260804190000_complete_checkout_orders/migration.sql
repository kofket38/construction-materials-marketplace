-- Add the complete checkout order status lifecycle while preserving legacy
-- values used by existing RFQ, seller, and admin workflows.
ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;

CREATE TYPE "OrderStatus_new" AS ENUM (
    'PENDING_PAYMENT',
    'PENDING_CONFIRMATION',
    'PROCESSING',
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
ALTER COLUMN "status" SET DEFAULT 'PENDING_CONFIRMATION';

CREATE TYPE "PaymentMethod" AS ENUM (
    'CASH_ON_DELIVERY',
    'BANK_TRANSFER',
    'ONLINE_PAYMENT'
);

ALTER TABLE "orders"
ADD COLUMN "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH_ON_DELIVERY',
ADD COLUMN "shippingFullName" TEXT,
ADD COLUMN "shippingPhone" TEXT,
ADD COLUMN "shippingCity" TEXT,
ADD COLUMN "shippingAddress" TEXT,
ADD COLUMN "shippingNotes" TEXT;

UPDATE "orders" AS orders
SET
    "shippingFullName" = COALESCE(NULLIF(users."name", ''), 'Not provided'),
    "shippingPhone" = COALESCE(NULLIF(users."phone", ''), 'Not provided'),
    "shippingCity" = 'Not provided',
    "shippingAddress" = 'Not provided'
FROM "users" AS users
WHERE users."id" = orders."customerId";

UPDATE "orders"
SET
    "shippingFullName" = COALESCE("shippingFullName", 'Not provided'),
    "shippingPhone" = COALESCE("shippingPhone", 'Not provided'),
    "shippingCity" = COALESCE("shippingCity", 'Not provided'),
    "shippingAddress" = COALESCE("shippingAddress", 'Not provided');

ALTER TABLE "orders"
ALTER COLUMN "shippingFullName" SET NOT NULL,
ALTER COLUMN "shippingFullName" SET DEFAULT 'Not provided',
ALTER COLUMN "shippingPhone" SET NOT NULL,
ALTER COLUMN "shippingPhone" SET DEFAULT 'Not provided',
ALTER COLUMN "shippingCity" SET NOT NULL,
ALTER COLUMN "shippingCity" SET DEFAULT 'Not provided',
ALTER COLUMN "shippingAddress" SET NOT NULL,
ALTER COLUMN "shippingAddress" SET DEFAULT 'Not provided';

ALTER TABLE "order_items"
ADD COLUMN "unitPrice" DECIMAL(12,2),
ADD COLUMN "subtotal" DECIMAL(14,2);

UPDATE "order_items"
SET
    "unitPrice" = "price",
    "subtotal" = "price" * "quantity";

ALTER TABLE "order_items"
ALTER COLUMN "unitPrice" SET NOT NULL,
ALTER COLUMN "unitPrice" SET DEFAULT 0,
ALTER COLUMN "subtotal" SET NOT NULL,
ALTER COLUMN "subtotal" SET DEFAULT 0;

-- Legacy RFQ code writes the existing price field. Keep the new checkout
-- pricing fields synchronized for those inserts without changing RFQ code.
CREATE FUNCTION sync_order_item_checkout_pricing()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."unitPrice" = 0 AND NEW."price" <> 0 THEN
        NEW."unitPrice" := NEW."price";
    END IF;

    IF NEW."subtotal" = 0 AND NEW."unitPrice" <> 0 THEN
        NEW."subtotal" := NEW."unitPrice" * NEW."quantity";
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_items_sync_checkout_pricing
BEFORE INSERT OR UPDATE OF "price", "unitPrice", "quantity"
ON "order_items"
FOR EACH ROW
EXECUTE FUNCTION sync_order_item_checkout_pricing();
