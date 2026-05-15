package protection

import (
	"fmt"

	"github.com/google/uuid"
	"wingert/backend/internal/domain"
)

// PeriodWriter handles the lifecycle of protection_periods rows in response
// to task-create events for Pflanzenschutz subtypes.
type PeriodWriter struct {
	periods domain.ProtectionPeriodRepository
}

func NewPeriodWriter(periods domain.ProtectionPeriodRepository) *PeriodWriter {
	return &PeriodWriter{periods: periods}
}

// OnTaskCreated inspects the task's Subtype and either opens a new
// protection_periods row (for *-haengen subtypes) or closes the
// most recent active row of the matching kind (for *-entfernen).
// "maehen" is a record-only subtype — no period state is tracked.
// No-op for tasks without a relevant subtype.
func (w *PeriodWriter) OnTaskCreated(t *domain.Task) error {
	if t == nil || t.Subtype == nil {
		return nil
	}
	sub := *t.Subtype

	var kind domain.ProtectionPeriodKind
	open := false
	targets := []uuid.UUID(nil)

	switch sub {
	case "dispenser-haengen":
		kind = domain.ProtectionPeriodDispenser
		open = true
		targets = traubenwicklerPestIDs()
	case "maehen":
		return nil // record-only, no period state
	default:
		return nil
	}

	if t.VineyardID == nil {
		return fmt.Errorf("subtype %q requires a vineyard_id on the task", sub)
	}

	if open {
		return w.periods.Create(domain.ProtectionPeriod{
			ID:            uuid.New(),
			VineyardID:    *t.VineyardID,
			Kind:          kind,
			StartTaskID:   t.ID,
			StartAt:       t.CreatedAt,
			TargetPestIDs: targets,
		})
	}
	return w.periods.CloseLatest(*t.VineyardID, kind, t.ID, t.CreatedAt)
}

func traubenwicklerPestIDs() []uuid.UUID {
	d := DiseaseByKey("traubenwickler")
	if d == nil {
		return nil
	}
	out := make([]uuid.UUID, len(d.PSMPestIDs))
	copy(out, d.PSMPestIDs)
	return out
}

