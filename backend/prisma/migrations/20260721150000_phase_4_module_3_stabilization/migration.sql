-- CreateIndex
CREATE INDEX "products_sellerId_categoryId_idx"
ON "products"("sellerId", "categoryId");

-- Enforce that every quoted line belongs to the same RFQ as its quotation.
CREATE FUNCTION "validate_supplier_quote_item_rfq"()
RETURNS TRIGGER AS $$
DECLARE
  quote_rfq_id UUID;
  item_rfq_id UUID;
BEGIN
  SELECT "rfqId"
  INTO quote_rfq_id
  FROM "supplier_quotes"
  WHERE "id" = NEW."quoteId";

  SELECT "rfqId"
  INTO item_rfq_id
  FROM "rfq_items"
  WHERE "id" = NEW."rfqItemId";

  IF quote_rfq_id IS NULL
    OR item_rfq_id IS NULL
    OR quote_rfq_id <> item_rfq_id
  THEN
    RAISE EXCEPTION
      'A supplier quote item must reference an RFQ item from the same RFQ.'
      USING
        ERRCODE = '23514',
        CONSTRAINT = 'supplier_quote_items_rfq_consistency_check';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "supplier_quote_items_rfq_consistency_trigger"
BEFORE INSERT OR UPDATE OF "quoteId", "rfqItemId"
ON "supplier_quote_items"
FOR EACH ROW
EXECUTE FUNCTION "validate_supplier_quote_item_rfq"();

-- Enforce that stored quote totals equal the final set of quoted lines.
CREATE FUNCTION "validate_supplier_quote_total"()
RETURNS TRIGGER AS $$
DECLARE
  target_quote_id UUID;
  stored_total NUMERIC(14, 2);
  calculated_total NUMERIC(14, 2);
BEGIN
  IF TG_TABLE_NAME = 'supplier_quotes' THEN
    target_quote_id := NEW."id";
  ELSIF TG_OP = 'DELETE' THEN
    target_quote_id := OLD."quoteId";
  ELSE
    target_quote_id := NEW."quoteId";
  END IF;

  SELECT "totalAmount"
  INTO stored_total
  FROM "supplier_quotes"
  WHERE "id" = target_quote_id;

  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM("lineTotal"), 0)
  INTO calculated_total
  FROM "supplier_quote_items"
  WHERE "quoteId" = target_quote_id;

  IF calculated_total <= 0 OR stored_total <> calculated_total THEN
    RAISE EXCEPTION
      'A supplier quotation total must equal the sum of its line totals.'
      USING
        ERRCODE = '23514',
        CONSTRAINT = 'supplier_quotes_total_consistency_check';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "supplier_quotes_total_consistency_trigger"
AFTER INSERT OR UPDATE
ON "supplier_quotes"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "validate_supplier_quote_total"();

CREATE CONSTRAINT TRIGGER "supplier_quote_items_total_consistency_trigger"
AFTER INSERT OR UPDATE OR DELETE
ON "supplier_quote_items"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "validate_supplier_quote_total"();

-- Enforce the final two-way relationship between awarded RFQs and accepted quotes.
CREATE FUNCTION "validate_rfq_award_consistency"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."status" = 'AWARDED' THEN
    PERFORM 1
    FROM "supplier_quotes"
    WHERE "id" = NEW."awardedQuoteId"
      AND "rfqId" = NEW."id"
      AND "status" = 'ACCEPTED';

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'An awarded RFQ must reference its accepted supplier quotation.'
        USING
          ERRCODE = '23514',
          CONSTRAINT = 'request_for_quotes_awarded_quote_consistency_check';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "request_for_quotes_awarded_quote_consistency_trigger"
AFTER INSERT OR UPDATE
ON "request_for_quotes"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "validate_rfq_award_consistency"();

CREATE FUNCTION "validate_accepted_quote_award_consistency"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."status" = 'ACCEPTED' THEN
    PERFORM 1
    FROM "request_for_quotes"
    WHERE "id" = NEW."rfqId"
      AND "status" = 'AWARDED'
      AND "awardedQuoteId" = NEW."id";

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'An accepted supplier quotation must be the awarded quotation for its RFQ.'
        USING
          ERRCODE = '23514',
          CONSTRAINT = 'supplier_quotes_accepted_award_consistency_check';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "supplier_quotes_accepted_award_consistency_trigger"
AFTER INSERT OR UPDATE
ON "supplier_quotes"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "validate_accepted_quote_award_consistency"();
