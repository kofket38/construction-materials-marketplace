-- CreateEnum
CREATE TYPE "ProductApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProductImageType" AS ENUM ('OFFICIAL', 'DEFAULT', 'SELLER_UPLOAD');

-- DropIndex
DROP INDEX "product_images_productId_createdAt_idx";

-- DropIndex
DROP INDEX "products_sellerId_categoryId_idx";

-- AlterTable
ALTER TABLE "product_images" ADD COLUMN     "type" "ProductImageType" NOT NULL DEFAULT 'DEFAULT';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "approvalStatus" "ProductApprovalStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "brandId" UUID,
ADD COLUMN     "createdBySellerId" UUID;

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_inventory" (
    "id" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "deliveryAvailable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brands_name_key" ON "brands"("name");

-- CreateIndex
CREATE INDEX "seller_inventory_productId_idx" ON "seller_inventory"("productId");

-- CreateIndex
CREATE INDEX "seller_inventory_city_idx" ON "seller_inventory"("city");

-- CreateIndex
CREATE UNIQUE INDEX "seller_inventory_sellerId_productId_key" ON "seller_inventory"("sellerId", "productId");

-- CreateIndex
CREATE INDEX "product_images_productId_idx" ON "product_images"("productId");

-- CreateIndex
CREATE INDEX "products_brandId_idx" ON "products"("brandId");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_createdBySellerId_fkey" FOREIGN KEY ("createdBySellerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_inventory" ADD CONSTRAINT "seller_inventory_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_inventory" ADD CONSTRAINT "seller_inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
