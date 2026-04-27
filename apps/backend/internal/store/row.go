package store

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"wingert/backend/internal/domain"
)

type rowRow struct {
	ID           uuid.UUID  `gorm:"column:id"`
	VineyardID   uuid.UUID  `gorm:"column:vineyard_id"`
	RowNumber    int        `gorm:"column:row_number"`
	Line         *geoJSON   `gorm:"column:line"`
	Variety      string     `gorm:"column:variety"`
	Status    string    `gorm:"column:status"`
	CreatedAt time.Time `gorm:"column:created_at"`
}

func (rowRow) TableName() string { return "rows" }

type RowStore struct{ db *gorm.DB }

func NewRowStore(db *gorm.DB) *RowStore { return &RowStore{db: db} }

func (s *RowStore) Create(vineyardID uuid.UUID, rowNumber int, line *domain.GeoJSON, variety string, status domain.RowStatus) (*domain.Row, error) {
	id := uuid.New()
	if status == "" {
		status = domain.RowStatusConfirmed
	}
	if line != nil && len(line.RawMessage) > 0 {
		err := s.db.Exec(
			`INSERT INTO rows (id, vineyard_id, row_number, line, variety, status)
			 VALUES (?, ?, ?, ST_GeomFromGeoJSON(?), ?, ?)`,
			id, vineyardID, rowNumber, string(line.RawMessage), variety, string(status),
		).Error
		if err != nil {
			return nil, err
		}
	} else {
		err := s.db.Exec(
			`INSERT INTO rows (id, vineyard_id, row_number, variety, status) VALUES (?, ?, ?, ?, ?)`,
			id, vineyardID, rowNumber, variety, string(status),
		).Error
		if err != nil {
			return nil, err
		}
	}
	return s.getByID(id)
}

func (s *RowStore) BulkCreate(rows []domain.Row) error {
	for _, r := range rows {
		line := toGeoJSON(r.Line)
		var lineSQL *string
		if line != nil && len(line.RawMessage) > 0 {
			s := string(line.RawMessage)
			lineSQL = &s
		}
		status := r.Status
		if status == "" {
			status = domain.RowStatusProposed
		}
		var err error
		if lineSQL != nil {
			err = s.db.Exec(
				`INSERT INTO rows (id, vineyard_id, row_number, line, variety, status)
				 VALUES (?, ?, ?, ST_GeomFromGeoJSON(?), ?, ?)`,
				r.ID, r.VineyardID, r.RowNumber, *lineSQL, r.Variety, string(status),
			).Error
		} else {
			err = s.db.Exec(
				`INSERT INTO rows (id, vineyard_id, row_number, variety, status) VALUES (?, ?, ?, ?, ?)`,
				r.ID, r.VineyardID, r.RowNumber, r.Variety, string(status),
			).Error
		}
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *RowStore) ListByVineyard(vineyardID uuid.UUID) ([]domain.Row, error) {
	var rows []rowRow
	err := s.db.Raw(
		`SELECT id, vineyard_id, row_number, variety, status, created_at,
		        ST_AsGeoJSON(line)::text AS line
		 FROM rows WHERE vineyard_id = ? ORDER BY row_number`, vineyardID,
	).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make([]domain.Row, len(rows))
	for i, r := range rows {
		result[i] = *toRow(r)
	}
	return result, nil
}

func (s *RowStore) UpdateStatus(id uuid.UUID, status domain.RowStatus) error {
	return s.db.Exec(`UPDATE rows SET status = ? WHERE id = ?`, string(status), id).Error
}

func (s *RowStore) UpdateLine(id uuid.UUID, line *domain.GeoJSON) error {
	if line == nil || len(line.RawMessage) == 0 {
		return nil
	}
	return s.db.Exec(
		`UPDATE rows SET line = ST_GeomFromGeoJSON(?) WHERE id = ?`,
		string(line.RawMessage), id,
	).Error
}

func (s *RowStore) Delete(id uuid.UUID) error {
	return s.db.Exec(`DELETE FROM rows WHERE id = ?`, id).Error
}

func (s *RowStore) DeleteProposedByVineyard(vineyardID uuid.UUID) error {
	return s.db.Exec(`DELETE FROM rows WHERE vineyard_id = ? AND status = 'proposed'`, vineyardID).Error
}

func (s *RowStore) NextRowNumber(vineyardID uuid.UUID) (int, error) {
	var max int
	err := s.db.Raw(`SELECT COALESCE(MAX(row_number), 0) FROM rows WHERE vineyard_id = ?`, vineyardID).Scan(&max).Error
	return max + 1, err
}

func (s *RowStore) getByID(id uuid.UUID) (*domain.Row, error) {
	var r rowRow
	err := s.db.Raw(
		`SELECT id, vineyard_id, row_number, variety, status, created_at,
		        ST_AsGeoJSON(line)::text AS line
		 FROM rows WHERE id = ?`, id,
	).Scan(&r).Error
	return toRow(r), err
}

func toRow(r rowRow) *domain.Row {
	status := domain.RowStatus(r.Status)
	if status == "" {
		status = domain.RowStatusConfirmed
	}
	return &domain.Row{
		ID:         r.ID,
		VineyardID: r.VineyardID,
		RowNumber:  r.RowNumber,
		Line:       fromGeoJSON(r.Line),
		Variety:    r.Variety,
		Status:     status,
		CreatedAt:  r.CreatedAt,
	}
}
