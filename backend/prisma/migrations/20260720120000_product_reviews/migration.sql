-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

-- CreateIndex
CREATE UNIQUE INDEX "reviews_customerId_productId_key"
ON "reviews"("customerId", "productId");

-- CreateIndex
CREATE INDEX "reviews_productId_createdAt_idx"
ON "reviews"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "reviews_customerId_idx"
ON "reviews"("customerId");

-- AddForeignKey
ALTER TABLE "reviews"
ADD CONSTRAINT "reviews_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "products"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews"
ADD CONSTRAINT "reviews_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
