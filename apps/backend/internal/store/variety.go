package store

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"wingert/backend/internal/domain"
)

type varietyRow struct {
	ID        uuid.UUID `gorm:"column:id"`
	Name      string    `gorm:"column:name"`
	Color     string    `gorm:"column:color"`
	CreatedBy uuid.UUID `gorm:"column:created_by"`
	CreatedAt time.Time `gorm:"column:created_at"`
}

func (varietyRow) TableName() string { return "grape_varieties" }

type GrapeVarietyStore struct{ db *gorm.DB }

func NewGrapeVarietyStore(db *gorm.DB) *GrapeVarietyStore { return &GrapeVarietyStore{db: db} }

func (s *GrapeVarietyStore) Create(name, color string, userID uuid.UUID) (*domain.GrapeVariety, error) {
	row := varietyRow{
		ID:        uuid.New(),
		Name:      name,
		Color:     color,
		CreatedBy: userID,
	}
	if err := s.db.Create(&row).Error; err != nil {
		return nil, err
	}
	return toVariety(row), nil
}

func (s *GrapeVarietyStore) ListByUser(userID uuid.UUID) ([]domain.GrapeVariety, error) {
	var rows []varietyRow
	if err := s.db.Where("created_by = ?", userID).Order("name ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	result := make([]domain.GrapeVariety, len(rows))
	for i, r := range rows {
		result[i] = *toVariety(r)
	}
	return result, nil
}

func (s *GrapeVarietyStore) Delete(id, userID uuid.UUID) error {
	return s.db.Where("id = ? AND created_by = ?", id, userID).Delete(&varietyRow{}).Error
}

func toVariety(r varietyRow) *domain.GrapeVariety {
	return &domain.GrapeVariety{
		ID:        r.ID,
		Name:      r.Name,
		Color:     r.Color,
		CreatedBy: r.CreatedBy,
		CreatedAt: r.CreatedAt,
	}
}
