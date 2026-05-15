ALTER TABLE spray_applications
    ADD COLUMN IF NOT EXISTS product_ids TEXT[] NOT NULL DEFAULT '{}';

-- Backfill from the legacy single-product column for existing rows.
-- Guarded so the migration is idempotent: on a DB where product_id was
-- already dropped, the inner UPDATE is skipped.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'spray_applications'
          AND column_name = 'product_id'
    ) THEN
        EXECUTE 'UPDATE spray_applications
                    SET product_ids = ARRAY[product_id]
                  WHERE product_id IS NOT NULL
                    AND COALESCE(array_length(product_ids, 1), 0) = 0';
    END IF;
END $$;

ALTER TABLE spray_applications
    DROP COLUMN IF EXISTS product_id;
