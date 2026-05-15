package store_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"wingert/backend/internal/domain"
	"wingert/backend/internal/store"
	"wingert/backend/internal/testutil"
)

func TestSprayStore_RoundTrip(t *testing.T) {
	db, cleanup := testutil.NewPostgresContainer(t)
	defer cleanup()
	testutil.RunMigrations(t, db)

	userID := uuid.New()
	require.NoError(t, db.Exec(`
        INSERT INTO users (id, email, name, role, password_hash, created_at)
        VALUES (?, 'a@b', 'X', 'admin', 'x', NOW())`, userID).Error)
	vyID := uuid.New()
	require.NoError(t, db.Exec(`
        INSERT INTO vineyards (id, name, owner_id, created_at)
        VALUES (?, 'V', ?, NOW())`, vyID, userID).Error)
	taskID := uuid.New()
	require.NoError(t, db.Exec(`
        INSERT INTO tasks (id, vineyard_id, title, record_type, category, status, created_at, subtype)
        VALUES (?, ?, 'Spritzung', 'aufgabe', 'pflanzenschutz', 'erledigt', NOW(), 'spritzung')`,
		taskID, vyID).Error)

	s := store.NewSprayStore(db)
	sid := uuid.New()
	when := time.Now()
	require.NoError(t, s.Create(domain.SprayApplication{
		TaskID:       taskID,
		SubstanceIDs: []uuid.UUID{sid},
		AppliedAt:    when,
	}))

	res, err := s.FindByVineyard(vyID, when.Add(-time.Hour))
	require.NoError(t, err)
	require.Len(t, res, 1)
	assert.Equal(t, taskID, res[0].TaskID)
	assert.Equal(t, []uuid.UUID{sid}, res[0].SubstanceIDs)
}
