ALTER TYPE "OrderStatus"
ADD VALUE IF NOT EXISTS 'PENDING_PAYMENT_VERIFICATION';

CREATE TYPE "PaymentStatus" AS ENUM (
  'PENDING_VERIFICATION',
  'VERIFIED',
  'REJECTED'
);

CREATE TABLE "payments" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "bankName" TEXT NOT NULL,
  "proofImageUrl" TEXT NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedAt" TIMESTAMP(3),

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payments_orderId_key" ON "payments"("orderId");
CREATE INDEX "payments_status_createdAt_idx"
ON "payments"("status", "createdAt");

ALTER TABLE "payments"
ADD CONSTRAINT "payments_orderId_fkey"
FOREIGN KEY ("orderId")
REFERENCES "orders"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
