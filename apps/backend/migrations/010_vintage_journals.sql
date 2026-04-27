CREATE TABLE IF NOT EXISTS vintage_journals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vineyard_id UUID NOT NULL REFERENCES vineyards(id) ON DELETE CASCADE,
  year        INTEGER NOT NULL,
  notes       TEXT NOT NULL DEFAULT '',
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vineyard_id, year)
);

CREATE INDEX IF NOT EXISTS idx_vintage_journals_vineyard_id ON vintage_journals(vineyard_id);
