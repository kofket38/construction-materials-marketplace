-- CreateEnum
CREATE TYPE "RfqStatus" AS ENUM ('OPEN', 'AWARDED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SupplierQuoteStatus" AS ENUM ('SUBMITTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'CLOSED');

-- CreateEnum
CREATE TYPE "RfqUnit" AS ENUM ('BAG', 'KG', 'TONNE', 'LITRE', 'METRE', 'SQUARE_METRE', 'CUBIC_METRE', 'PIECE', 'ROLL', 'PALLET', 'LOAD', 'OTHER');

-- CreateTable
CREATE TABLE "request_for_quotes" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "deliveryLocation" TEXT NOT NULL,
    "notes" TEXT,
    "status" "RfqStatus" NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "awardedQuoteId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "request_for_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfq_items" (
    "id" UUID NOT NULL,
    "rfqId" UUID NOT NULL,
    "categoryId" UUID,
    "preferredProductId" UUID,
    "categoryName" TEXT NOT NULL,
    "materialName" TEXT NOT NULL,
    "specifications" TEXT,
    "requestedQuantity" DECIMAL(14,3) NOT NULL,
    "requestedUnit" "RfqUnit" NOT NULL,
    "customUnit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rfq_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_quotes" (
    "id" UUID NOT NULL,
    "rfqId" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "status" "SupplierQuoteStatus" NOT NULL DEFAULT 'SUBMITTED',
    "validUntil" TIMESTAMP(3) NOT NULL,
    "leadTimeDays" INTEGER NOT NULL,
    "terms" TEXT,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "orderId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_quote_items" (
    "id" UUID NOT NULL,
    "quoteId" UUID NOT NULL,
    "rfqItemId" UUID NOT NULL,
    "productId" UUID,
    "productName" TEXT NOT NULL,
    "offeredQuantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "request_for_quotes_awardedQuoteId_key" ON "request_for_quotes"("awardedQuoteId");

-- CreateIndex
CREATE INDEX "request_for_quotes_customerId_createdAt_idx" ON "request_for_quotes"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "request_for_quotes_status_expiresAt_idx" ON "request_for_quotes"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "request_for_quotes_createdAt_idx" ON "request_for_quotes"("createdAt");

-- CreateIndex
CREATE INDEX "rfq_items_rfqId_idx" ON "rfq_items"("rfqId");

-- CreateIndex
CREATE INDEX "rfq_items_categoryId_idx" ON "rfq_items"("categoryId");

-- CreateIndex
CREATE INDEX "rfq_items_preferredProductId_idx" ON "rfq_items"("preferredProductId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_quotes_orderId_key" ON "supplier_quotes"("orderId");

-- CreateIndex
CREATE INDEX "supplier_quotes_rfqId_status_idx" ON "supplier_quotes"("rfqId", "status");

-- CreateIndex
CREATE INDEX "supplier_quotes_sellerId_createdAt_idx" ON "supplier_quotes"("sellerId", "createdAt");

-- CreateIndex
CREATE INDEX "supplier_quotes_sellerId_status_idx" ON "supplier_quotes"("sellerId", "status");

-- CreateIndex
CREATE INDEX "supplier_quotes_validUntil_idx" ON "supplier_quotes"("validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_quotes_rfqId_sellerId_key" ON "supplier_quotes"("rfqId", "sellerId");

-- CreateIndex
CREATE INDEX "supplier_quote_items_rfqItemId_idx" ON "supplier_quote_items"("rfqItemId");

-- CreateIndex
CREATE INDEX "supplier_quote_items_productId_idx" ON "supplier_quote_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_quote_items_quoteId_rfqItemId_key" ON "supplier_quote_items"("quoteId", "rfqItemId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_quote_items_quoteId_productId_key" ON "supplier_quote_items"("quoteId", "productId");

-- AddForeignKey
ALTER TABLE "request_for_quotes" ADD CONSTRAINT "request_for_quotes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_for_quotes" ADD CONSTRAINT "request_for_quotes_awardedQuoteId_fkey" FOREIGN KEY ("awardedQuoteId") REFERENCES "supplier_quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_items" ADD CONSTRAINT "rfq_items_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "request_for_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_items" ADD CONSTRAINT "rfq_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfq_items" ADD CONSTRAINT "rfq_items_preferredProductId_fkey" FOREIGN KEY ("preferredProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_quotes" ADD CONSTRAINT "supplier_quotes_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "request_for_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_quotes" ADD CONSTRAINT "supplier_quotes_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_quotes" ADD CONSTRAINT "supplier_quotes_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_quote_items" ADD CONSTRAINT "supplier_quote_items_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "supplier_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_quote_items" ADD CONSTRAINT "supplier_quote_items_rfqItemId_fkey" FOREIGN KEY ("rfqItemId") REFERENCES "rfq_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_quote_items" ADD CONSTRAINT "supplier_quote_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
