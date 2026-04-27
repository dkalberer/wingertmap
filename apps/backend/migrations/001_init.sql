CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT UNIQUE NOT NULL,
    name          TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'viewer',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vineyards (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    description TEXT,
    boundary    GEOMETRY(POLYGON, 4326),
    owner_id    UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rows (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vineyard_id UUID REFERENCES vineyards(id) ON DELETE CASCADE,
    row_number  INT NOT NULL,
    line        GEOMETRY(LINESTRING, 4326),
    variety     TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(vineyard_id, row_number)
);

CREATE TABLE IF NOT EXISTS vines (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    row_id      UUID REFERENCES rows(id) ON DELETE CASCADE,
    vine_number INT NOT NULL,
    position    GEOMETRY(POINT, 4326),
    notes       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(row_id, vine_number)
);

CREATE TABLE IF NOT EXISTS tasks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vine_id      UUID REFERENCES vines(id) ON DELETE CASCADE,
    type         TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'offen',
    notes        TEXT,
    assigned_to  UUID REFERENCES users(id),
    due_date     DATE,
    completed_at TIMESTAMPTZ,
    created_by   UUID REFERENCES users(id),
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vineyards_boundary ON vineyards USING GIST(boundary);
CREATE INDEX IF NOT EXISTS idx_rows_line          ON rows       USING GIST(line);
CREATE INDEX IF NOT EXISTS idx_vines_position     ON vines      USING GIST(position);
