-- Checkout orders set their new initial status explicitly. Keep the legacy
-- database default for RFQ-created orders that intentionally omit status.
ALTER TABLE "orders"
ALTER COLUMN "status" SET DEFAULT 'PENDING';
