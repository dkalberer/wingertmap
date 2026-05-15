ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS subtype TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'tasks_subtype_requires_pflanzenschutz'
    ) THEN
        ALTER TABLE tasks
            ADD CONSTRAINT tasks_subtype_requires_pflanzenschutz
            CHECK (subtype IS NULL OR category = 'pflanzenschutz');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS spray_applications (
    task_id          UUID          PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
    product_id       TEXT          REFERENCES psm_products(id),
    substance_ids    UUID[]        NOT NULL,
    target_pest_ids  UUID[],
    dosage           NUMERIC(10,4),
    dosage_unit      TEXT,
    applied_at       TIMESTAMPTZ   NOT NULL,
    notes            TEXT
);

CREATE INDEX IF NOT EXISTS idx_spray_applications_applied
    ON spray_applications (applied_at DESC);
