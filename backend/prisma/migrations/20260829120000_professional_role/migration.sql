-- M1 (Professional Identity): introduce the real PROFESSIONAL role.
-- The value could not be used in the same transaction it is created in
-- (PostgreSQL restriction), so the data backfill lives in the next migration.
ALTER TYPE "Role" ADD VALUE 'PROFESSIONAL';
