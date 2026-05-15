package protection_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"wingert/backend/internal/domain"
	"wingert/backend/internal/protection"
)

type recordingPeriods struct {
	created []domain.ProtectionPeriod
	closed  []struct {
		vineyardID uuid.UUID
		kind       domain.ProtectionPeriodKind
		endTaskID  uuid.UUID
		endAt      time.Time
	}
	active map[domain.ProtectionPeriodKind]*domain.ProtectionPeriod
}

func (r *recordingPeriods) Create(p domain.ProtectionPeriod) error {
	r.created = append(r.created, p)
	return nil
}
func (r *recordingPeriods) FindActive(_ uuid.UUID, kind domain.ProtectionPeriodKind) (*domain.ProtectionPeriod, error) {
	if r.active == nil {
		return nil, nil
	}
	return r.active[kind], nil
}
func (r *recordingPeriods) CloseLatest(vineyardID uuid.UUID, kind domain.ProtectionPeriodKind, endTaskID uuid.UUID, endAt time.Time) error {
	r.closed = append(r.closed, struct {
		vineyardID uuid.UUID
		kind       domain.ProtectionPeriodKind
		endTaskID  uuid.UUID
		endAt      time.Time
	}{vineyardID, kind, endTaskID, endAt})
	return nil
}
func (r *recordingPeriods) LatestMaehenTask(_ uuid.UUID) (*time.Time, error) { return nil, nil }

var traubenwicklerPests = []uuid.UUID{
	uuid.MustParse("884fbf9b-a098-4936-9caa-57056026d69e"),
	uuid.MustParse("5ac77f67-4abf-460f-825c-a82d635bda38"),
	uuid.MustParse("711c42ab-e781-4501-b0f4-cfbbdc89c83f"),
}

func TestPeriodWriter_DispenserHaengenOpensPeriod(t *testing.T) {
	rec := &recordingPeriods{}
	w := protection.NewPeriodWriter(rec)

	vyID := uuid.New()
	sub := "dispenser-haengen"
	task := &domain.Task{ID: uuid.New(), VineyardID: &vyID, Subtype: &sub, CreatedAt: time.Now()}
	require.NoError(t, w.OnTaskCreated(task))
	require.Len(t, rec.created, 1)
	p := rec.created[0]
	assert.Equal(t, vyID, p.VineyardID)
	assert.Equal(t, domain.ProtectionPeriodDispenser, p.Kind)
	assert.Equal(t, task.ID, p.StartTaskID)
	assert.ElementsMatch(t, traubenwicklerPests, p.TargetPestIDs)
}

func TestPeriodWriter_MaehenIsNoOp(t *testing.T) {
	rec := &recordingPeriods{}
	w := protection.NewPeriodWriter(rec)

	vyID := uuid.New()
	sub := "maehen"
	task := &domain.Task{ID: uuid.New(), VineyardID: &vyID, Subtype: &sub, CreatedAt: time.Now()}
	require.NoError(t, w.OnTaskCreated(task))
	assert.Empty(t, rec.created)
	assert.Empty(t, rec.closed)
}

func TestPeriodWriter_OtherSubtypesNoOp(t *testing.T) {
	rec := &recordingPeriods{}
	w := protection.NewPeriodWriter(rec)
	vyID := uuid.New()
	sub := "spritzung"
	task := &domain.Task{ID: uuid.New(), VineyardID: &vyID, Subtype: &sub, CreatedAt: time.Now()}
	require.NoError(t, w.OnTaskCreated(task))
	assert.Empty(t, rec.created)
	assert.Empty(t, rec.closed)
}

func TestPeriodWriter_NoVineyardIDIsError(t *testing.T) {
	rec := &recordingPeriods{}
	w := protection.NewPeriodWriter(rec)
	sub := "dispenser-haengen"
	task := &domain.Task{ID: uuid.New(), Subtype: &sub, CreatedAt: time.Now()}
	err := w.OnTaskCreated(task)
	assert.Error(t, err)
}

func TestPeriodWriter_NilTaskOrSubtypeNoOp(t *testing.T) {
	rec := &recordingPeriods{}
	w := protection.NewPeriodWriter(rec)
	assert.NoError(t, w.OnTaskCreated(nil))
	require.NoError(t, w.OnTaskCreated(&domain.Task{}))
	assert.Empty(t, rec.created)
	assert.Empty(t, rec.closed)
}
