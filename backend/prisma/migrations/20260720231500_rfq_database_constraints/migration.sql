-- AddCheckConstraint
ALTER TABLE "request_for_quotes"
ADD CONSTRAINT "request_for_quotes_expiry_check"
CHECK ("expiresAt" > "createdAt");

-- AddCheckConstraint
ALTER TABLE "request_for_quotes"
ADD CONSTRAINT "request_for_quotes_award_state_check"
CHECK (
  (
    "status" = 'AWARDED'
    AND "awardedQuoteId" IS NOT NULL
  )
  OR (
    "status" <> 'AWARDED'
    AND "awardedQuoteId" IS NULL
  )
);

-- AddCheckConstraint
ALTER TABLE "rfq_items"
ADD CONSTRAINT "rfq_items_requested_quantity_check"
CHECK ("requestedQuantity" > 0);

-- AddCheckConstraint
ALTER TABLE "rfq_items"
ADD CONSTRAINT "rfq_items_custom_unit_check"
CHECK (
  (
    "requestedUnit" = 'OTHER'
    AND "customUnit" IS NOT NULL
    AND LENGTH(BTRIM("customUnit")) > 0
  )
  OR (
    "requestedUnit" <> 'OTHER'
    AND "customUnit" IS NULL
  )
);

-- AddCheckConstraint
ALTER TABLE "supplier_quotes"
ADD CONSTRAINT "supplier_quotes_validity_check"
CHECK ("validUntil" > "createdAt");

-- AddCheckConstraint
ALTER TABLE "supplier_quotes"
ADD CONSTRAINT "supplier_quotes_lead_time_check"
CHECK ("leadTimeDays" BETWEEN 0 AND 365);

-- AddCheckConstraint
ALTER TABLE "supplier_quotes"
ADD CONSTRAINT "supplier_quotes_total_amount_check"
CHECK ("totalAmount" > 0);

-- AddCheckConstraint
ALTER TABLE "supplier_quotes"
ADD CONSTRAINT "supplier_quotes_acceptance_state_check"
CHECK (
  (
    "status" = 'ACCEPTED'
    AND "orderId" IS NOT NULL
  )
  OR (
    "status" <> 'ACCEPTED'
    AND "orderId" IS NULL
  )
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_quotes_one_accepted_per_rfq_idx"
ON "supplier_quotes"("rfqId")
WHERE "status" = 'ACCEPTED';

-- AddCheckConstraint
ALTER TABLE "supplier_quote_items"
ADD CONSTRAINT "supplier_quote_items_offered_quantity_check"
CHECK ("offeredQuantity" > 0);

-- AddCheckConstraint
ALTER TABLE "supplier_quote_items"
ADD CONSTRAINT "supplier_quote_items_unit_price_check"
CHECK ("unitPrice" > 0);

-- AddCheckConstraint
ALTER TABLE "supplier_quote_items"
ADD CONSTRAINT "supplier_quote_items_line_total_check"
CHECK (
  "lineTotal" > 0
  AND "lineTotal" = ROUND("unitPrice" * "offeredQuantity", 2)
);
