package store_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"wingert/backend/internal/domain"
	"wingert/backend/internal/store"
	"wingert/backend/internal/testutil"
)

func TestVineyardStore(t *testing.T) {
	db, cleanup := testutil.NewPostgresContainer(t)
	defer cleanup()
	testutil.RunMigrations(t, db)

	ownerID := uuid.New()
	require.NoError(t, db.Exec(
		`INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
		ownerID, "owner@example.com", "Owner", "hash", "admin",
	).Error)

	s := store.NewVineyardStore(db)

	boundary := &domain.GeoJSON{RawMessage: json.RawMessage(
		`{"type":"Polygon","coordinates":[[[7.5,47.5],[7.6,47.5],[7.6,47.6],[7.5,47.6],[7.5,47.5]]]}`,
	)}

	v, err := s.Create("Testberg", "Beschreibung", boundary, ownerID)
	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, v.ID)
	assert.Equal(t, "Testberg", v.Name)

	loaded, err := s.GetByID(v.ID)
	require.NoError(t, err)
	assert.Equal(t, "Testberg", loaded.Name)
	assert.NotNil(t, loaded.Boundary)

	list, err := s.ListByOwner(ownerID)
	require.NoError(t, err)
	assert.Len(t, list, 1)

	require.NoError(t, s.Update(v.ID, "Neuer Name", "Neu", boundary))
	updated, _ := s.GetByID(v.ID)
	assert.Equal(t, "Neuer Name", updated.Name)

	require.NoError(t, s.Delete(v.ID))
	_, err = s.GetByID(v.ID)
	assert.Error(t, err)
}

func TestVineyardDeleteCascade(t *testing.T) {
	db, cleanup := testutil.NewPostgresContainer(t)
	defer cleanup()
	testutil.RunMigrations(t, db)

	ownerID := uuid.New()
	require.NoError(t, db.Exec(
		`INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
		ownerID, "o2@example.com", "O2", "x", "viewer",
	).Error)

	vineyardStore := store.NewVineyardStore(db)
	v, err := vineyardStore.Create("Cascade", "", nil, ownerID)
	require.NoError(t, err)

	rowID := uuid.New()
	require.NoError(t, db.Exec(
		`INSERT INTO rows (id, vineyard_id, row_number, variety) VALUES (?, ?, ?, ?)`,
		rowID, v.ID, 1, "",
	).Error)
	vineID := uuid.New()
	require.NoError(t, db.Exec(
		`INSERT INTO vines (id, row_id, vine_number) VALUES (?, ?, ?)`,
		vineID, rowID, 1,
	).Error)

	require.NoError(t, vineyardStore.Delete(v.ID))

	var rowCount, vineCount int64
	db.Raw("SELECT COUNT(*) FROM rows WHERE vineyard_id = ?", v.ID).Scan(&rowCount)
	db.Raw("SELECT COUNT(*) FROM vines WHERE row_id = ?", rowID).Scan(&vineCount)
	assert.Zero(t, rowCount)
	assert.Zero(t, vineCount)
}

func TestVineStoreFindNearby(t *testing.T) {
	db, cleanup := testutil.NewPostgresContainer(t)
	defer cleanup()
	testutil.RunMigrations(t, db)

	ownerID := uuid.New()
	require.NoError(t, db.Exec(
		`INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
		ownerID, "vv@example.com", "V", "x", "viewer",
	).Error)
	vineyardID := uuid.New()
	require.NoError(t, db.Exec(
		`INSERT INTO vineyards (id, name, owner_id) VALUES (?, ?, ?)`,
		vineyardID, "V", ownerID,
	).Error)
	rowID := uuid.New()
	require.NoError(t, db.Exec(
		`INSERT INTO rows (id, vineyard_id, row_number, variety) VALUES (?, ?, ?, ?)`,
		rowID, vineyardID, 1, "",
	).Error)

	vs := store.NewVineStore(db)

	pos1 := &domain.GeoJSON{RawMessage: json.RawMessage(`{"type":"Point","coordinates":[7.550000,47.550000]}`)}
	pos2 := &domain.GeoJSON{RawMessage: json.RawMessage(`{"type":"Point","coordinates":[7.900000,47.900000]}`)}

	vine1, err := vs.Create(rowID, 1, pos1, "")
	require.NoError(t, err)
	_, err = vs.Create(rowID, 2, pos2, "")
	require.NoError(t, err)

	nearby, err := vs.FindNearby(47.550000, 7.550000, 100)
	require.NoError(t, err)
	require.Len(t, nearby, 1)
	assert.Equal(t, vine1.ID, nearby[0].ID)

	all, err := vs.FindNearby(47.550000, 7.550000, 100000)
	require.NoError(t, err)
	assert.Len(t, all, 2)

	none, err := vs.FindNearby(52.0, 13.0, 100)
	require.NoError(t, err)
	assert.Len(t, none, 0)
}

func TestTaskStore(t *testing.T) {
	db, cleanup := testutil.NewPostgresContainer(t)
	defer cleanup()
	testutil.RunMigrations(t, db)

	userID := uuid.New()
	require.NoError(t, db.Exec(
		`INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
		userID, "t@example.com", "T", "x", "viewer",
	).Error)
	vineyardID := uuid.New()
	require.NoError(t, db.Exec(
		`INSERT INTO vineyards (id, name, owner_id) VALUES (?, ?, ?)`,
		vineyardID, "V", userID,
	).Error)
	rowID := uuid.New()
	require.NoError(t, db.Exec(
		`INSERT INTO rows (id, vineyard_id, row_number, variety) VALUES (?, ?, ?, ?)`,
		rowID, vineyardID, 1, "",
	).Error)
	vineID := uuid.New()
	require.NoError(t, db.Exec(
		`INSERT INTO vines (id, row_id, vine_number) VALUES (?, ?, ?)`,
		vineID, rowID, 1,
	).Error)

	ts := store.NewTaskStore(db)

	due := time.Now().Add(24 * time.Hour).Format(time.RFC3339)
	task, err := ts.Create(domain.TaskCreateParams{
		VineID:     &vineID,
		Title:      "Beschnitt",
		RecordType: domain.RecordTypeAufgabe,
		Category:   domain.CategoryRebenpflege,
		Notes:      "Beschnitt",
		DueDate:    &due,
		CreatedBy:  userID,
	})
	require.NoError(t, err)
	assert.NotEqual(t, uuid.Nil, task.ID)
	assert.Equal(t, domain.TaskStatusOpen, task.Status)
	assert.Equal(t, domain.RecordTypeAufgabe, task.RecordType)
	assert.Equal(t, domain.CategoryRebenpflege, task.Category)
	assert.NotNil(t, task.DueDate)

	tasks, err := ts.ListByVine(vineID)
	require.NoError(t, err)
	assert.Len(t, tasks, 1)

	updated, err := ts.UpdateStatus(task.ID, domain.TaskStatusDone)
	require.NoError(t, err)
	assert.Equal(t, domain.TaskStatusDone, updated.Status)
	assert.NotNil(t, updated.CompletedAt)
}
