package store

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"wingert/backend/internal/domain"
)

type journalScanRow struct {
	ID         uuid.UUID `gorm:"column:id"`
	VineyardID uuid.UUID `gorm:"column:vineyard_id"`
	Year       int       `gorm:"column:year"`
	Notes      string    `gorm:"column:notes"`
	CreatedBy  uuid.UUID `gorm:"column:created_by"`
	CreatedAt  time.Time `gorm:"column:created_at"`
	UpdatedAt  time.Time `gorm:"column:updated_at"`
}

type JournalStore struct{ db *gorm.DB }

func NewJournalStore(db *gorm.DB) *JournalStore { return &JournalStore{db: db} }

func (s *JournalStore) ListByVineyard(vineyardID uuid.UUID) ([]domain.VintageJournal, error) {
	return s.query("vineyard_id = ?", vineyardID)
}

func (s *JournalStore) GetByYear(vineyardID uuid.UUID, year int) (*domain.VintageJournal, error) {
	rows, err := s.db.Raw(`
		SELECT id, vineyard_id, year, notes, created_by, created_at, updated_at
		FROM vintage_journals
		WHERE vineyard_id = ? AND year = ?`, vineyardID, year).
		Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var r journalScanRow
	if rows.Next() {
		if err := s.db.ScanRows(rows, &r); err != nil {
			return nil, err
		}
		j := toJournal(r)
		return &j, nil
	}
	return nil, nil
}

func (s *JournalStore) Upsert(vineyardID uuid.UUID, year int, notes string, createdBy uuid.UUID) (*domain.VintageJournal, error) {
	id := uuid.New()
	err := s.db.Exec(`
		INSERT INTO vintage_journals (id, vineyard_id, year, notes, created_by)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT (vineyard_id, year)
		DO UPDATE SET notes = EXCLUDED.notes, updated_at = NOW()`,
		id, vineyardID, year, notes, createdBy,
	).Error
	if err != nil {
		return nil, err
	}
	return s.GetByYear(vineyardID, year)
}

func (s *JournalStore) query(where string, arg any) ([]domain.VintageJournal, error) {
	var rows []journalScanRow
	err := s.db.Raw(`
		SELECT id, vineyard_id, year, notes, created_by, created_at, updated_at
		FROM vintage_journals
		WHERE `+where+`
		ORDER BY year DESC`, arg).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make([]domain.VintageJournal, len(rows))
	for i, r := range rows {
		result[i] = toJournal(r)
	}
	return result, nil
}

func toJournal(r journalScanRow) domain.VintageJournal {
	return domain.VintageJournal{
		ID:         r.ID,
		VineyardID: r.VineyardID,
		Year:       r.Year,
		Notes:      r.Notes,
		CreatedBy:  r.CreatedBy,
		CreatedAt:  r.CreatedAt,
		UpdatedAt:  r.UpdatedAt,
	}
}
