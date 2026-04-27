ALTER TABLE tasks
    ALTER COLUMN vine_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS location GEOMETRY(POINT, 4326),
    ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS vineyard_id UUID REFERENCES vineyards(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_location    ON tasks USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_tasks_vineyard_id ON tasks (vineyard_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by  ON tasks (created_by);
