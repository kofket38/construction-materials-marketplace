ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CBE_BANK';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'AWASH_BANK';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'DASHEN_BANK';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'E_BIRR';

ALTER TABLE "seller_profiles"
ADD COLUMN "paymentAccountName" TEXT,
ADD COLUMN "telebirrNumber" TEXT,
ADD COLUMN "cbeBirrNumber" TEXT,
ADD COLUMN "cbeBankAccountNumber" TEXT,
ADD COLUMN "awashBankAccountNumber" TEXT,
ADD COLUMN "dashenBankAccountNumber" TEXT,
ADD COLUMN "eBirrNumber" TEXT;
