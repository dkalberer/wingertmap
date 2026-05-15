package store

import (
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/gorm"
	"wingert/backend/internal/domain"
)

type ProtectionPeriodStore struct{ db *gorm.DB }

func NewProtectionPeriodStore(db *gorm.DB) *ProtectionPeriodStore {
	return &ProtectionPeriodStore{db: db}
}

func (s *ProtectionPeriodStore) Create(p domain.ProtectionPeriod) error {
	return s.db.Exec(`
        INSERT INTO protection_periods (id, vineyard_id, kind, start_task_id,
            end_task_id, start_at, end_at, target_pest_ids)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		p.ID, p.VineyardID, p.Kind, p.StartTaskID,
		p.EndTaskID, p.StartAt, p.EndAt, pq.Array(p.TargetPestIDs)).Error
}

func (s *ProtectionPeriodStore) FindActive(vineyardID uuid.UUID, kind domain.ProtectionPeriodKind) (*domain.ProtectionPeriod, error) {
	var row struct {
		ID            uuid.UUID      `gorm:"column:id"`
		VineyardID    uuid.UUID      `gorm:"column:vineyard_id"`
		Kind          string         `gorm:"column:kind"`
		StartTaskID   uuid.UUID      `gorm:"column:start_task_id"`
		EndTaskID     *uuid.UUID     `gorm:"column:end_task_id"`
		StartAt       time.Time      `gorm:"column:start_at"`
		EndAt         *time.Time     `gorm:"column:end_at"`
		TargetPestIDs pq.StringArray `gorm:"column:target_pest_ids"`
	}
	err := s.db.Raw(`
        SELECT id, vineyard_id, kind, start_task_id, end_task_id, start_at, end_at,
               target_pest_ids::text[]
        FROM protection_periods
        WHERE vineyard_id = ? AND kind = ? AND end_at IS NULL
        ORDER BY start_at DESC LIMIT 1`, vineyardID, kind).Scan(&row).Error
	if err != nil {
		return nil, err
	}
	if row.ID == uuid.Nil {
		return nil, nil
	}
	return &domain.ProtectionPeriod{
		ID:            row.ID,
		VineyardID:    row.VineyardID,
		Kind:          domain.ProtectionPeriodKind(row.Kind),
		StartTaskID:   row.StartTaskID,
		EndTaskID:     row.EndTaskID,
		StartAt:       row.StartAt,
		EndAt:         row.EndAt,
		TargetPestIDs: parseUUIDArray(row.TargetPestIDs),
	}, nil
}

func (s *ProtectionPeriodStore) CloseLatest(vineyardID uuid.UUID, kind domain.ProtectionPeriodKind, endTaskID uuid.UUID, endAt time.Time) error {
	return s.db.Exec(`
        UPDATE protection_periods
        SET end_at = ?, end_task_id = ?
        WHERE id = (
            SELECT id FROM protection_periods
            WHERE vineyard_id = ? AND kind = ? AND end_at IS NULL
            ORDER BY start_at DESC LIMIT 1)`,
		endAt, endTaskID, vineyardID, kind).Error
}

func (s *ProtectionPeriodStore) LatestMaehenTask(vineyardID uuid.UUID) (*time.Time, error) {
	var row struct {
		CreatedAt time.Time `gorm:"column:created_at"`
	}
	err := s.db.Raw(`
        SELECT created_at FROM tasks
        WHERE vineyard_id = ? AND subtype = 'maehen'
        ORDER BY created_at DESC LIMIT 1`, vineyardID).Scan(&row).Error
	if err != nil {
		return nil, err
	}
	if row.CreatedAt.IsZero() {
		return nil, nil
	}
	t := row.CreatedAt
	return &t, nil
}
