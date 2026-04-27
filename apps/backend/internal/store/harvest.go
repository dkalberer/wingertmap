package store

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"wingert/backend/internal/domain"
)

type harvestScanRow struct {
	ID            uuid.UUID `gorm:"column:id"`
	VineyardID    uuid.UUID `gorm:"column:vineyard_id"`
	VarietyID     uuid.UUID `gorm:"column:variety_id"`
	VarietyName   string    `gorm:"column:variety_name"`
	VarietyColor  string    `gorm:"column:variety_color"`
	HarvestDate   time.Time `gorm:"column:harvest_date"`
	WeightKg      float64   `gorm:"column:weight_kg"`
	Oechsle       *int      `gorm:"column:oechsle"`
	Notes         string    `gorm:"column:notes"`
	CreatedBy     uuid.UUID `gorm:"column:created_by"`
	CreatedAt     time.Time `gorm:"column:created_at"`
}

type HarvestStore struct{ db *gorm.DB }

func NewHarvestStore(db *gorm.DB) *HarvestStore { return &HarvestStore{db: db} }

func (s *HarvestStore) Create(p domain.HarvestCreateParams) (*domain.Harvest, error) {
	id := uuid.New()
	err := s.db.Exec(`
		INSERT INTO harvests (id, vineyard_id, variety_id, harvest_date, weight_kg, oechsle, notes, created_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		id, p.VineyardID, p.VarietyID, p.HarvestDate, p.WeightKg, p.Oechsle, p.Notes, p.CreatedBy,
	).Error
	if err != nil {
		return nil, err
	}
	return s.loadOne(id)
}

func (s *HarvestStore) ListByVineyard(vineyardID uuid.UUID) ([]domain.Harvest, error) {
	return s.query("h.vineyard_id = ?", vineyardID)
}

func (s *HarvestStore) Update(id uuid.UUID, p domain.HarvestUpdateParams) (*domain.Harvest, error) {
	err := s.db.Exec(`
		UPDATE harvests
		SET variety_id = ?, harvest_date = ?, weight_kg = ?, oechsle = ?, notes = ?
		WHERE id = ?`,
		p.VarietyID, p.HarvestDate, p.WeightKg, p.Oechsle, p.Notes, id,
	).Error
	if err != nil {
		return nil, err
	}
	return s.loadOne(id)
}

func (s *HarvestStore) Delete(id uuid.UUID) error {
	return s.db.Exec("DELETE FROM harvests WHERE id = ?", id).Error
}

func (s *HarvestStore) loadOne(id uuid.UUID) (*domain.Harvest, error) {
	rows, err := s.query("h.id = ?", id)
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	return &rows[0], nil
}

func (s *HarvestStore) query(where string, arg any) ([]domain.Harvest, error) {
	var rows []harvestScanRow
	err := s.db.Raw(`
		SELECT h.id, h.vineyard_id, h.variety_id,
		       gv.name  AS variety_name,
		       gv.color AS variety_color,
		       h.harvest_date, h.weight_kg, h.oechsle, h.notes,
		       h.created_by, h.created_at
		FROM harvests h
		LEFT JOIN grape_varieties gv ON gv.id = h.variety_id
		WHERE `+where+`
		ORDER BY h.harvest_date DESC`, arg).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make([]domain.Harvest, len(rows))
	for i, r := range rows {
		result[i] = domain.Harvest{
			ID:          r.ID,
			VineyardID:  r.VineyardID,
			VarietyID:   r.VarietyID,
			HarvestDate: r.HarvestDate,
			WeightKg:    r.WeightKg,
			Oechsle:     r.Oechsle,
			Notes:       r.Notes,
			CreatedBy:   r.CreatedBy,
			CreatedAt:   r.CreatedAt,
		}
		if r.VarietyName != "" {
			result[i].Variety = &domain.GrapeVariety{
				ID:    r.VarietyID,
				Name:  r.VarietyName,
				Color: r.VarietyColor,
			}
		}
	}
	return result, nil
}
