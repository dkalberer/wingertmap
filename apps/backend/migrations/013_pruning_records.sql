CREATE TABLE IF NOT EXISTS pruning_records (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    vineyard_id    UUID        NOT NULL REFERENCES vineyards(id) ON DELETE CASCADE,
    year           INTEGER     NOT NULL,
    pruning_date   DATE        NOT NULL,
    schnitt_typ    TEXT        NOT NULL,
    augen_pro_rebe NUMERIC(4,1),
    notes          TEXT,
    created_by     UUID        NOT NULL REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (vineyard_id, year)
);

CREATE INDEX IF NOT EXISTS idx_pruning_records_vineyard_id ON pruning_records (vineyard_id);
