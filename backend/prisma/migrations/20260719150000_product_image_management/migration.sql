-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_images_productId_createdAt_idx" ON "product_images"("productId", "createdAt");

-- Preserve existing single-image products as managed primary images.
INSERT INTO "product_images" ("id", "productId", "imageUrl", "isPrimary", "createdAt")
SELECT gen_random_uuid(), "id", "imageUrl", true, "createdAt"
FROM "products"
WHERE "imageUrl" IS NOT NULL;

-- PostgreSQL partial uniqueness allows multiple non-primary images while
-- enforcing at most one primary image per product.
CREATE UNIQUE INDEX "product_images_one_primary_per_product_idx"
ON "product_images" ("productId")
WHERE "isPrimary" = true;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
