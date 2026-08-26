-- CreateTable
CREATE TABLE "portfolio_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profileId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000),
    "projectType" VARCHAR(150),
    "location" VARCHAR(200),
    "completionDate" TIMESTAMP(3),
    "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolio_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portfolio_items_profileId_displayOrder_idx" ON "portfolio_items"("profileId", "displayOrder");

-- AddForeignKey
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
