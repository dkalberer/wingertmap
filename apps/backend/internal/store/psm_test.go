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

func newPSMStore(t *testing.T) (*store.PSMStore, func()) {
	db, cleanup := testutil.NewPostgresContainer(t)
	testutil.RunMigrations(t, db)
	return store.NewPSMStore(db), cleanup
}

func sampleBatch() domain.PSMBatch {
	sid := uuid.MustParse("683783d6-0b1f-43d4-bf12-209fd6e3c693")
	pid := uuid.MustParse("0251feea-4e71-4881-8b0a-09874f39277a")
	return domain.PSMBatch{
		SyncedAt:          time.Now(),
		Substances:        []domain.PSMSubstance{{ID: sid, NameDE: "Folpet"}},
		Pests:             []domain.PSMPest{{ID: pid, NameDE: "Falscher Mehltau der Rebe"}},
		Products:          []domain.PSMProduct{{ID: "4090", WNbr: "W-4090", Name: "Aktuan"}},
		ProductSubstances: []domain.PSMProductSubstance{{ProductID: "4090", SubstanceID: sid}},
		Indications:       []domain.PSMIndication{{ProductID: "4090", PestID: pid}},
	}
}

func TestPSMStore_UpsertAndSearch(t *testing.T) {
	s, cleanup := newPSMStore(t)
	defer cleanup()

	b := sampleBatch()
	require.NoError(t, s.UpsertBatch(b))

	results, err := s.SearchProducts("Aktu", 10)
	require.NoError(t, err)
	require.Len(t, results, 1)
	assert.Equal(t, "Aktuan", results[0].Name)

	prod, err := s.GetProduct("4090")
	require.NoError(t, err)
	require.NotNil(t, prod)
	require.Len(t, prod.Substances, 1)
	assert.Equal(t, "Folpet", prod.Substances[0].NameDE)
	require.Len(t, prod.Indications, 1)
}

func TestPSMStore_GetPestsForSubstances(t *testing.T) {
	s, cleanup := newPSMStore(t)
	defer cleanup()

	require.NoError(t, s.UpsertBatch(sampleBatch()))

	sid := uuid.MustParse("683783d6-0b1f-43d4-bf12-209fd6e3c693")
	pests, err := s.GetPestsForSubstances([]uuid.UUID{sid})
	require.NoError(t, err)
	require.Len(t, pests, 1)
}
