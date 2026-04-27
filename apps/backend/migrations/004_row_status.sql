ALTER TABLE rows ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed';

CREATE INDEX IF NOT EXISTS idx_rows_status ON rows(status);
