package store

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"wingert/backend/internal/domain"
)

type workTypeScanRow struct {
	ID        uuid.UUID `gorm:"column:id"`
	Name      string    `gorm:"column:name"`
	CreatedBy uuid.UUID `gorm:"column:created_by"`
	CreatedAt time.Time `gorm:"column:created_at"`
}

type WorkTypeStore struct{ db *gorm.DB }

func NewWorkTypeStore(db *gorm.DB) *WorkTypeStore { return &WorkTypeStore{db: db} }

func (s *WorkTypeStore) Create(name string, createdBy uuid.UUID) (*domain.WorkType, error) {
	id := uuid.New()
	err := s.db.Exec(
		`INSERT INTO work_types (id, name, created_by) VALUES (?, ?, ?)`,
		id, name, createdBy,
	).Error
	if err != nil {
		return nil, err
	}
	return s.loadOne(id)
}

func (s *WorkTypeStore) ListByUser(userID uuid.UUID) ([]domain.WorkType, error) {
	var rows []workTypeScanRow
	err := s.db.Raw(
		`SELECT id, name, created_by, created_at FROM work_types WHERE created_by = ? ORDER BY name`,
		userID,
	).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make([]domain.WorkType, len(rows))
	for i, r := range rows {
		result[i] = domain.WorkType{ID: r.ID, Name: r.Name, CreatedBy: r.CreatedBy, CreatedAt: r.CreatedAt}
	}
	return result, nil
}

func (s *WorkTypeStore) Delete(id, userID uuid.UUID) error {
	return s.db.Exec(`DELETE FROM work_types WHERE id = ? AND created_by = ?`, id, userID).Error
}

func (s *WorkTypeStore) loadOne(id uuid.UUID) (*domain.WorkType, error) {
	var r workTypeScanRow
	err := s.db.Raw(
		`SELECT id, name, created_by, created_at FROM work_types WHERE id = ?`, id,
	).Scan(&r).Error
	if err != nil {
		return nil, err
	}
	wt := domain.WorkType{ID: r.ID, Name: r.Name, CreatedBy: r.CreatedBy, CreatedAt: r.CreatedAt}
	return &wt, nil
}
