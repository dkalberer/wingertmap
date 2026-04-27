package store

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"wingert/backend/internal/domain"
)

type vineRow struct {
	ID         uuid.UUID `gorm:"column:id"`
	RowID      uuid.UUID `gorm:"column:row_id"`
	VineNumber int       `gorm:"column:vine_number"`
	Position   *geoJSON  `gorm:"column:position"`
	Notes      string    `gorm:"column:notes"`
	CreatedAt  time.Time `gorm:"column:created_at"`
}

func (vineRow) TableName() string { return "vines" }

type VineStore struct{ db *gorm.DB }

func NewVineStore(db *gorm.DB) *VineStore { return &VineStore{db: db} }

func (s *VineStore) Create(rowID uuid.UUID, vineNumber int, position *domain.GeoJSON, notes string) (*domain.Vine, error) {
	id := uuid.New()
	if position != nil && len(position.RawMessage) > 0 {
		err := s.db.Exec(
			`INSERT INTO vines (id, row_id, vine_number, position, notes) VALUES (?, ?, ?, ST_GeomFromGeoJSON(?), ?)`,
			id, rowID, vineNumber, string(position.RawMessage), notes,
		).Error
		if err != nil {
			return nil, err
		}
	} else {
		err := s.db.Exec(
			`INSERT INTO vines (id, row_id, vine_number, notes) VALUES (?, ?, ?, ?)`,
			id, rowID, vineNumber, notes,
		).Error
		if err != nil {
			return nil, err
		}
	}
	return s.getByID(id)
}

func (s *VineStore) ListByRow(rowID uuid.UUID) ([]domain.Vine, error) {
	var rows []vineRow
	err := s.db.Raw(
		`SELECT id, row_id, vine_number, notes, created_at,
		        ST_AsGeoJSON(position)::text AS position
		 FROM vines WHERE row_id = ? ORDER BY vine_number`, rowID,
	).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make([]domain.Vine, len(rows))
	for i, r := range rows {
		result[i] = *vineToVine(r)
	}
	return result, nil
}

func (s *VineStore) FindNearby(lat, lng, radiusMeters float64) ([]domain.Vine, error) {
	var rows []vineRow
	err := s.db.Raw(
		`SELECT id, row_id, vine_number, notes, created_at,
		        ST_AsGeoJSON(position)::text AS position
		 FROM vines
		 WHERE ST_DWithin(
		     position::geography,
		     ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography,
		     ?
		 )`, lng, lat, radiusMeters,
	).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make([]domain.Vine, len(rows))
	for i, r := range rows {
		result[i] = *vineToVine(r)
	}
	return result, nil
}

func (s *VineStore) getByID(id uuid.UUID) (*domain.Vine, error) {
	var r vineRow
	err := s.db.Raw(
		`SELECT id, row_id, vine_number, notes, created_at,
		        ST_AsGeoJSON(position)::text AS position
		 FROM vines WHERE id = ?`, id,
	).Scan(&r).Error
	return vineToVine(r), err
}

func vineToVine(r vineRow) *domain.Vine {
	return &domain.Vine{
		ID:         r.ID,
		RowID:      r.RowID,
		VineNumber: r.VineNumber,
		Position:   fromGeoJSON(r.Position),
		Notes:      r.Notes,
		CreatedAt:  r.CreatedAt,
	}
}
