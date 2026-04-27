package store

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"wingert/backend/internal/domain"
)

type vineyardRow struct {
	ID          uuid.UUID  `gorm:"column:id"`
	Name        string     `gorm:"column:name"`
	Description string     `gorm:"column:description"`
	Boundary    *geoJSON   `gorm:"column:boundary"`
	OwnerID     *uuid.UUID `gorm:"column:owner_id"`
	CreatedAt   time.Time  `gorm:"column:created_at"`
}

func (vineyardRow) TableName() string { return "vineyards" }

type VineyardStore struct{ db *gorm.DB }

func NewVineyardStore(db *gorm.DB) *VineyardStore { return &VineyardStore{db: db} }

func (s *VineyardStore) Create(name, description string, boundary *domain.GeoJSON, ownerID uuid.UUID) (*domain.Vineyard, error) {
	id := uuid.New()
	if boundary != nil && len(boundary.RawMessage) > 0 {
		err := s.db.Exec(
			`INSERT INTO vineyards (id, name, description, boundary, owner_id)
			 VALUES (?, ?, ?, ST_GeomFromGeoJSON(?), ?)`,
			id, name, description, string(boundary.RawMessage), ownerID,
		).Error
		if err != nil {
			return nil, err
		}
	} else {
		err := s.db.Exec(
			`INSERT INTO vineyards (id, name, description, owner_id) VALUES (?, ?, ?, ?)`,
			id, name, description, ownerID,
		).Error
		if err != nil {
			return nil, err
		}
	}
	return s.GetByID(id)
}

func (s *VineyardStore) GetByID(id uuid.UUID) (*domain.Vineyard, error) {
	var row vineyardRow
	err := s.db.Raw(
		`SELECT id, name, description, owner_id, created_at,
		        ST_AsGeoJSON(boundary)::text AS boundary
		 FROM vineyards WHERE id = ?`, id,
	).Scan(&row).Error
	if err != nil {
		return nil, err
	}
	if row.ID == uuid.Nil {
		return nil, errors.New("vineyard not found")
	}
	return rowToVineyard(row), nil
}

func (s *VineyardStore) ListByOwner(ownerID uuid.UUID) ([]domain.Vineyard, error) {
	var rows []vineyardRow
	err := s.db.Raw(
		`SELECT id, name, description, owner_id, created_at,
		        ST_AsGeoJSON(boundary)::text AS boundary
		 FROM vineyards WHERE owner_id = ?`, ownerID,
	).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make([]domain.Vineyard, len(rows))
	for i, r := range rows {
		result[i] = *rowToVineyard(r)
	}
	return result, nil
}

func (s *VineyardStore) Update(id uuid.UUID, name, description string, boundary *domain.GeoJSON) error {
	if boundary != nil && len(boundary.RawMessage) > 0 {
		return s.db.Exec(
			`UPDATE vineyards SET name = ?, description = ?, boundary = ST_GeomFromGeoJSON(?) WHERE id = ?`,
			name, description, string(boundary.RawMessage), id,
		).Error
	}
	return s.db.Exec(
		`UPDATE vineyards SET name = ?, description = ? WHERE id = ?`,
		name, description, id,
	).Error
}

func (s *VineyardStore) Delete(id uuid.UUID) error {
	return s.db.Exec(`DELETE FROM vineyards WHERE id = ?`, id).Error
}

func rowToVineyard(r vineyardRow) *domain.Vineyard {
	return &domain.Vineyard{
		ID:          r.ID,
		Name:        r.Name,
		Description: r.Description,
		Boundary:    fromGeoJSON(r.Boundary),
		OwnerID:     r.OwnerID,
		CreatedAt:   r.CreatedAt,
	}
}
