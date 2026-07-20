-- CreateTable
CREATE TABLE "wishlist_items" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_items_customerId_productId_key"
ON "wishlist_items"("customerId", "productId");

-- CreateIndex
CREATE INDEX "wishlist_items_customerId_createdAt_idx"
ON "wishlist_items"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "wishlist_items_productId_idx"
ON "wishlist_items"("productId");

-- AddForeignKey
ALTER TABLE "wishlist_items"
ADD CONSTRAINT "wishlist_items_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items"
ADD CONSTRAINT "wishlist_items_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "products"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
