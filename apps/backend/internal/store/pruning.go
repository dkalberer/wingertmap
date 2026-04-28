package store

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"wingert/backend/internal/domain"
)

type pruningRow struct {
	ID           uuid.UUID          `gorm:"column:id"`
	VineyardID   uuid.UUID          `gorm:"column:vineyard_id"`
	Year         int                `gorm:"column:year"`
	PruningDate  time.Time          `gorm:"column:pruning_date"`
	SchnittTyp   domain.SchnittTyp  `gorm:"column:schnitt_typ"`
	AugenProRebe *float64           `gorm:"column:augen_pro_rebe"`
	Notes        string             `gorm:"column:notes"`
	CreatedBy    uuid.UUID          `gorm:"column:created_by"`
	CreatedAt    time.Time          `gorm:"column:created_at"`
}

type PruningStore struct{ db *gorm.DB }

func NewPruningStore(db *gorm.DB) *PruningStore { return &PruningStore{db: db} }

func (s *PruningStore) Create(p domain.PruningCreateParams) (*domain.PruningRecord, error) {
	id := uuid.New()
	err := s.db.Exec(`
		INSERT INTO pruning_records
		    (id, vineyard_id, year, pruning_date, schnitt_typ, augen_pro_rebe, notes, created_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		id, p.VineyardID, p.Year, p.PruningDate, p.SchnittTyp, p.AugenProRebe, p.Notes, p.CreatedBy,
	).Error
	if err != nil {
		return nil, err
	}
	return s.loadOne(id)
}

func (s *PruningStore) ListByVineyard(vineyardID uuid.UUID) ([]domain.PruningRecord, error) {
	return s.query("vineyard_id = ?", vineyardID)
}

func (s *PruningStore) Update(id uuid.UUID, p domain.PruningUpdateParams) (*domain.PruningRecord, error) {
	err := s.db.Exec(`
		UPDATE pruning_records
		SET year = ?, pruning_date = ?, schnitt_typ = ?, augen_pro_rebe = ?, notes = ?
		WHERE id = ?`,
		p.Year, p.PruningDate, p.SchnittTyp, p.AugenProRebe, p.Notes, id,
	).Error
	if err != nil {
		return nil, err
	}
	return s.loadOne(id)
}

func (s *PruningStore) Delete(id uuid.UUID) error {
	return s.db.Exec("DELETE FROM pruning_records WHERE id = ?", id).Error
}

func (s *PruningStore) loadOne(id uuid.UUID) (*domain.PruningRecord, error) {
	rows, err := s.query("id = ?", id)
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	return &rows[0], nil
}

func (s *PruningStore) query(where string, arg any) ([]domain.PruningRecord, error) {
	var rows []pruningRow
	err := s.db.Raw(`
		SELECT id, vineyard_id, year, pruning_date, schnitt_typ, augen_pro_rebe, notes, created_by, created_at
		FROM pruning_records
		WHERE `+where+`
		ORDER BY year DESC`, arg).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make([]domain.PruningRecord, len(rows))
	for i, r := range rows {
		result[i] = domain.PruningRecord{
			ID:           r.ID,
			VineyardID:   r.VineyardID,
			Year:         r.Year,
			PruningDate:  r.PruningDate,
			SchnittTyp:   r.SchnittTyp,
			AugenProRebe: r.AugenProRebe,
			Notes:        r.Notes,
			CreatedBy:    r.CreatedBy,
			CreatedAt:    r.CreatedAt,
		}
	}
	return result, nil
}
