package store

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"wingert/backend/internal/domain"
)

type employeeScanRow struct {
	ID        uuid.UUID `gorm:"column:id"`
	Name      string    `gorm:"column:name"`
	CreatedBy uuid.UUID `gorm:"column:created_by"`
	CreatedAt time.Time `gorm:"column:created_at"`
}

type EmployeeStore struct{ db *gorm.DB }

func NewEmployeeStore(db *gorm.DB) *EmployeeStore { return &EmployeeStore{db: db} }

func (s *EmployeeStore) Create(name string, createdBy uuid.UUID) (*domain.Employee, error) {
	id := uuid.New()
	err := s.db.Exec(
		`INSERT INTO employees (id, name, created_by) VALUES (?, ?, ?)`,
		id, name, createdBy,
	).Error
	if err != nil {
		return nil, err
	}
	return s.loadOne(id)
}

func (s *EmployeeStore) ListByUser(userID uuid.UUID) ([]domain.Employee, error) {
	var rows []employeeScanRow
	err := s.db.Raw(
		`SELECT id, name, created_by, created_at FROM employees WHERE created_by = ? ORDER BY name`,
		userID,
	).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make([]domain.Employee, len(rows))
	for i, r := range rows {
		result[i] = domain.Employee{ID: r.ID, Name: r.Name, CreatedBy: r.CreatedBy, CreatedAt: r.CreatedAt}
	}
	return result, nil
}

func (s *EmployeeStore) Delete(id, userID uuid.UUID) error {
	return s.db.Exec(`DELETE FROM employees WHERE id = ? AND created_by = ?`, id, userID).Error
}

func (s *EmployeeStore) loadOne(id uuid.UUID) (*domain.Employee, error) {
	var r employeeScanRow
	err := s.db.Raw(
		`SELECT id, name, created_by, created_at FROM employees WHERE id = ?`, id,
	).Scan(&r).Error
	if err != nil {
		return nil, err
	}
	e := domain.Employee{ID: r.ID, Name: r.Name, CreatedBy: r.CreatedBy, CreatedAt: r.CreatedAt}
	return &e, nil
}
