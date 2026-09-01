-- M1 (Professional Identity): backfill existing professional workspace users.
-- Scope is deliberately narrow: only CUSTOMER accounts that already own a
-- professional profile or own a project are reclassified. Sellers,
-- administrators, and ordinary customers are never touched. Idempotent —
-- re-running matches zero rows.
UPDATE "users"
SET "role" = 'PROFESSIONAL'
WHERE "role" = 'CUSTOMER'
  AND (
    "id" IN (SELECT "userId" FROM "professional_profiles")
    OR "id" IN (SELECT "ownerId" FROM "projects")
  );
