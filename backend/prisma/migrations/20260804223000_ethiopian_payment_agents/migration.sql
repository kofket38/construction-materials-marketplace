ALTER TABLE "orders"
ALTER COLUMN "paymentMethod" DROP DEFAULT;

ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";

CREATE TYPE "PaymentMethod" AS ENUM (
  'CASH_ON_DELIVERY',
  'TELEBIRR',
  'CBE_BIRR',
  'AWASH_BIRR',
  'BANK_TRANSFER'
);

ALTER TABLE "orders"
ALTER COLUMN "paymentMethod" TYPE "PaymentMethod"
USING (
  CASE
    WHEN "paymentMethod"::text = 'ONLINE_PAYMENT' THEN 'BANK_TRANSFER'
    ELSE "paymentMethod"::text
  END
)::"PaymentMethod";

ALTER TABLE "payments"
ALTER COLUMN "method" TYPE "PaymentMethod"
USING (
  CASE
    WHEN "method"::text = 'ONLINE_PAYMENT' THEN 'BANK_TRANSFER'
    ELSE "method"::text
  END
)::"PaymentMethod";

DROP TYPE "PaymentMethod_old";

ALTER TABLE "orders"
ALTER COLUMN "paymentMethod"
SET DEFAULT 'CASH_ON_DELIVERY';

ALTER TABLE "payments"
RENAME COLUMN "bankName" TO "providerName";
