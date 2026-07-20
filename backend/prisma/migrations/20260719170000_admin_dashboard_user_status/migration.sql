-- AlterTable
ALTER TABLE "users"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "users_isActive_idx" ON "users"("isActive");
