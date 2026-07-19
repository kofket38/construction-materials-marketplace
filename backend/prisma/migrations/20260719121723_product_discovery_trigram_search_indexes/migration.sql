-- Accelerate the case-insensitive substring searches used by product discovery.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "products_name_trgm_idx"
ON "products" USING GIN ("name" gin_trgm_ops);

CREATE INDEX "products_description_trgm_idx"
ON "products" USING GIN ("description" gin_trgm_ops);

CREATE INDEX "seller_profiles_shopName_trgm_idx"
ON "seller_profiles" USING GIN ("shopName" gin_trgm_ops);