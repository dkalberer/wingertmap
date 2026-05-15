package store

import (
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/gorm"
	"wingert/backend/internal/domain"
)

type SprayStore struct{ db *gorm.DB }

func NewSprayStore(db *gorm.DB) *SprayStore { return &SprayStore{db: db} }

func (s *SprayStore) Create(a domain.SprayApplication) error {
	productIDs := a.ProductIDs
	if productIDs == nil {
		productIDs = []string{}
	}
	return s.db.Exec(`
        INSERT INTO spray_applications (task_id, product_ids, substance_ids, target_pest_ids,
            dosage, dosage_unit, applied_at, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		a.TaskID, pq.Array(productIDs), pq.Array(a.SubstanceIDs),
		pq.Array(a.TargetPestIDs), a.Dosage, a.DosageUnit, a.AppliedAt, a.Notes).Error
}

func (s *SprayStore) FindByVineyard(vineyardID uuid.UUID, since time.Time) ([]domain.SprayApplication, error) {
	var rows []struct {
		TaskID        uuid.UUID      `gorm:"column:task_id"`
		ProductIDs    pq.StringArray `gorm:"column:product_ids"`
		SubstanceIDs  pq.StringArray `gorm:"column:substance_ids"`
		TargetPestIDs pq.StringArray `gorm:"column:target_pest_ids"`
		Dosage        *float64
		DosageUnit    string    `gorm:"column:dosage_unit"`
		AppliedAt     time.Time `gorm:"column:applied_at"`
		Notes         string
	}
	err := s.db.Raw(`
        SELECT sa.task_id, sa.product_ids, sa.substance_ids::text[], sa.target_pest_ids::text[],
               sa.dosage, sa.dosage_unit, sa.applied_at, sa.notes
        FROM spray_applications sa
        JOIN tasks t ON t.id = sa.task_id
        WHERE t.vineyard_id = ? AND sa.applied_at >= ?
        ORDER BY sa.applied_at DESC`, vineyardID, since).Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	out := make([]domain.SprayApplication, len(rows))
	for i, r := range rows {
		out[i] = domain.SprayApplication{
			TaskID:        r.TaskID,
			ProductIDs:    []string(r.ProductIDs),
			SubstanceIDs:  parseUUIDArray(r.SubstanceIDs),
			TargetPestIDs: parseUUIDArray(r.TargetPestIDs),
			Dosage:        r.Dosage,
			DosageUnit:    r.DosageUnit,
			AppliedAt:     r.AppliedAt,
			Notes:         r.Notes,
		}
	}
	return out, nil
}

func parseUUIDArray(s pq.StringArray) []uuid.UUID {
	out := make([]uuid.UUID, 0, len(s))
	for _, v := range s {
		if u, err := uuid.Parse(v); err == nil {
			out = append(out, u)
		}
	}
	return out
}
