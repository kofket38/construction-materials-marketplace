-- Add sellerId and city to inventory_transactions.
-- Existing rows are backfilled from the owning product's sellerId and
-- city is set to 'legacy' because the per-city inventory rows did not
-- exist when those transactions were recorded.

-- Step 1: add nullable columns so the ALTER does not fail on existing rows.
ALTER TABLE "inventory_transactions"
  ADD COLUMN "sellerId" UUID,
  ADD COLUMN "city"     TEXT;

-- Step 2: backfill sellerId from the product's owning seller.
UPDATE "inventory_transactions" it
SET    "sellerId" = p."sellerId"
FROM   "products" p
WHERE  p."id" = it."productId";

-- Step 3: backfill city as a sentinel for legacy rows.
UPDATE "inventory_transactions"
SET    "city" = 'legacy'
WHERE  "city" IS NULL;

-- Step 4: make columns non-nullable now that all rows have values.
ALTER TABLE "inventory_transactions"
  ALTER COLUMN "sellerId" SET NOT NULL,
  ALTER COLUMN "city"     SET NOT NULL;

-- Step 5: index and foreign key.
CREATE INDEX "inventory_transactions_sellerId_idx"
  ON "inventory_transactions"("sellerId");

ALTER TABLE "inventory_transactions"
  ADD CONSTRAINT "inventory_transactions_sellerId_fkey"
  FOREIGN KEY ("sellerId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
