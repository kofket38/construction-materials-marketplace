-- AlterTable
ALTER TABLE "request_for_quotes" ADD COLUMN     "projectId" UUID;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "projectId" UUID;

-- CreateIndex
CREATE INDEX "request_for_quotes_projectId_createdAt_idx" ON "request_for_quotes"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_projectId_createdAt_idx" ON "orders"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "request_for_quotes" ADD CONSTRAINT "request_for_quotes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
