CREATE TABLE IF NOT EXISTS harvests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vineyard_id  UUID NOT NULL REFERENCES vineyards(id) ON DELETE CASCADE,
  variety_id   UUID NOT NULL REFERENCES grape_varieties(id) ON DELETE RESTRICT,
  harvest_date DATE NOT NULL,
  weight_kg    NUMERIC(10,2) NOT NULL,
  oechsle      INTEGER,
  notes        TEXT,
  created_by   UUID NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_harvests_vineyard_id ON harvests(vineyard_id);
CREATE INDEX IF NOT EXISTS idx_harvests_harvest_date ON harvests(harvest_date);
