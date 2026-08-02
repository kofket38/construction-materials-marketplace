-- Validate both the source and destination quotation when a line moves.
CREATE OR REPLACE FUNCTION "validate_supplier_quote_total"()
RETURNS TRIGGER AS $$
DECLARE
  target_quote_ids UUID[];
  target_quote_id UUID;
  stored_total NUMERIC(14, 2);
  calculated_total NUMERIC(14, 2);
BEGIN
  IF TG_TABLE_NAME = 'supplier_quotes' THEN
    target_quote_ids := ARRAY[NEW."id"];
  ELSIF TG_OP = 'DELETE' THEN
    target_quote_ids := ARRAY[OLD."quoteId"];
  ELSIF TG_OP = 'UPDATE'
    AND OLD."quoteId" IS DISTINCT FROM NEW."quoteId"
  THEN
    target_quote_ids := ARRAY[OLD."quoteId", NEW."quoteId"];
  ELSE
    target_quote_ids := ARRAY[NEW."quoteId"];
  END IF;

  FOREACH target_quote_id IN ARRAY target_quote_ids
  LOOP
    SELECT "totalAmount"
    INTO stored_total
    FROM "supplier_quotes"
    WHERE "id" = target_quote_id;

    IF NOT FOUND THEN
      CONTINUE;
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
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Prevent either half of an awarded RFQ relationship from changing alone.
CREATE OR REPLACE FUNCTION "validate_rfq_award_consistency"()
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

  IF TG_OP = 'UPDATE' THEN
    IF OLD."status" = 'AWARDED'
      AND (
        NEW."status" <> 'AWARDED'
        OR NEW."awardedQuoteId" IS DISTINCT FROM OLD."awardedQuoteId"
      )
      AND OLD."awardedQuoteId" IS NOT NULL
    THEN
      PERFORM 1
      FROM "supplier_quotes"
      WHERE "id" = OLD."awardedQuoteId"
        AND "rfqId" = OLD."id"
        AND "status" = 'ACCEPTED';

      IF FOUND THEN
        RAISE EXCEPTION
          'An RFQ cannot stop awarding a supplier quotation that remains accepted.'
          USING
            ERRCODE = '23514',
            CONSTRAINT = 'request_for_quotes_previous_award_consistency_check';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "validate_accepted_quote_award_consistency"()
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

  IF TG_OP = 'UPDATE' THEN
    IF OLD."status" = 'ACCEPTED'
      AND (
        NEW."status" <> 'ACCEPTED'
        OR NEW."rfqId" IS DISTINCT FROM OLD."rfqId"
      )
    THEN
      PERFORM 1
      FROM "request_for_quotes"
      WHERE "id" = OLD."rfqId"
        AND "status" = 'AWARDED'
        AND "awardedQuoteId" = OLD."id";

      IF FOUND THEN
        RAISE EXCEPTION
          'An accepted supplier quotation cannot change while its RFQ still awards it.'
          USING
            ERRCODE = '23514',
            CONSTRAINT = 'supplier_quotes_previous_acceptance_consistency_check';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
