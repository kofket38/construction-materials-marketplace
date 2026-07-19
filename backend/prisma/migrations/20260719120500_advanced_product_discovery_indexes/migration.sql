-- Support product discovery price, stock, and creation-time filters/sorts.
CREATE INDEX "products_price_idx" ON "products"("price");
CREATE INDEX "products_quantity_idx" ON "products"("quantity");
CREATE INDEX "products_createdAt_idx" ON "products"("createdAt");
