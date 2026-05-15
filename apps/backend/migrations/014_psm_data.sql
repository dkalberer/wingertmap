CREATE TABLE IF NOT EXISTS psm_substances (
    id          UUID         PRIMARY KEY,
    name_de     TEXT         NOT NULL,
    name_fr     TEXT,
    name_it     TEXT,
    synced_at   TIMESTAMPTZ  NOT NULL
);

CREATE TABLE IF NOT EXISTS psm_pests (
    id          UUID         PRIMARY KEY,
    name_de     TEXT         NOT NULL,
    name_fr     TEXT,
    name_it     TEXT,
    synced_at   TIMESTAMPTZ  NOT NULL
);

CREATE TABLE IF NOT EXISTS psm_products (
    id                    TEXT         PRIMARY KEY,
    w_nbr                 TEXT         NOT NULL,
    name                  TEXT         NOT NULL,
    permission_holder_id  UUID,
    exhaustion_deadline   DATE,
    soldout_deadline      DATE,
    termination_reason    TEXT,
    is_parallel_import    BOOLEAN      NOT NULL DEFAULT FALSE,
    synced_at             TIMESTAMPTZ  NOT NULL
);

-- pg_trgm extension needed for product name autocomplete (similarity, gin_trgm_ops)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_psm_products_name_trgm
    ON psm_products USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS psm_product_substances (
    product_id          TEXT     NOT NULL REFERENCES psm_products(id) ON DELETE CASCADE,
    substance_id        UUID     NOT NULL REFERENCES psm_substances(id),
    in_percent          NUMERIC(8,4),
    in_gramm_per_litre  NUMERIC(10,4),
    PRIMARY KEY (product_id, substance_id)
);

CREATE TABLE IF NOT EXISTS psm_indications (
    id                    BIGSERIAL    PRIMARY KEY,
    product_id            TEXT         NOT NULL REFERENCES psm_products(id) ON DELETE CASCADE,
    pest_id               UUID         NOT NULL REFERENCES psm_pests(id),
    culture_id            UUID         NOT NULL,
    dosage_from           NUMERIC(10,4),
    dosage_to             NUMERIC(10,4),
    dosage_unit           TEXT,
    waiting_period_days   INTEGER,
    application_area      TEXT,
    expenditure_form      TEXT
);

CREATE INDEX IF NOT EXISTS idx_psm_indications_pest    ON psm_indications(pest_id);
CREATE INDEX IF NOT EXISTS idx_psm_indications_product ON psm_indications(product_id);

CREATE TABLE IF NOT EXISTS psm_sync_meta (
    id                       INT         PRIMARY KEY DEFAULT 1,
    last_sync_at             TIMESTAMPTZ NOT NULL,
    source_publication_date  DATE,
    product_count            INT,
    status                   TEXT,
    error_message            TEXT,
    CHECK (id = 1)
);
