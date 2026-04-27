package migrations_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"wingert/backend/internal/testutil"
)

func TestMigrations(t *testing.T) {
	db, cleanup := testutil.NewPostgresContainer(t)
	defer cleanup()

	testutil.RunMigrations(t, db)

	tables := []string{"users", "vineyards", "rows", "vines", "tasks", "task_photos"}
	for _, tbl := range tables {
		var count int64
		err := db.Raw("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name=?", tbl).Scan(&count).Error
		require.NoError(t, err, "checking table %s", tbl)
		assert.Equal(t, int64(1), count, "table %s should exist", tbl)
	}

	// PostGIS extension
	var extCount int64
	err := db.Raw("SELECT COUNT(*) FROM pg_extension WHERE extname='postgis'").Scan(&extCount).Error
	require.NoError(t, err)
	assert.Equal(t, int64(1), extCount, "postgis extension should be installed")

	// GIST indices
	indices := map[string]string{
		"idx_vineyards_boundary": "vineyards",
		"idx_rows_line":          "rows",
		"idx_vines_position":     "vines",
	}
	for idx, tbl := range indices {
		var idxCount int64
		err := db.Raw(
			"SELECT COUNT(*) FROM pg_indexes WHERE tablename=? AND indexname=?", tbl, idx,
		).Scan(&idxCount).Error
		require.NoError(t, err)
		assert.Equal(t, int64(1), idxCount, "index %s on %s should exist", idx, tbl)
	}
}
