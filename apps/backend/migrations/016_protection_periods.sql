CREATE TABLE IF NOT EXISTS protection_periods (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    vineyard_id       UUID         NOT NULL REFERENCES vineyards(id) ON DELETE CASCADE,
    kind              TEXT         NOT NULL CHECK (kind IN ('dispenser', 'mowing-pause')),
    start_task_id     UUID         NOT NULL REFERENCES tasks(id),
    end_task_id       UUID         REFERENCES tasks(id),
    start_at          TIMESTAMPTZ  NOT NULL,
    end_at            TIMESTAMPTZ,
    target_pest_ids   UUID[]       NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_protection_periods_vineyard
    ON protection_periods (vineyard_id);

CREATE INDEX IF NOT EXISTS idx_protection_periods_active
    ON protection_periods (vineyard_id, kind) WHERE end_at IS NULL;
