package store

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"wingert/backend/internal/domain"
)

type taskRow struct {
	ID          uuid.UUID            `gorm:"column:id"`
	VineID      *uuid.UUID           `gorm:"column:vine_id"`
	VineyardID  *uuid.UUID           `gorm:"column:vineyard_id"`
	Title       string               `gorm:"column:title"`
	RecordType  domain.RecordType    `gorm:"column:record_type"`
	Category    domain.TaskCategory  `gorm:"column:category"`
	Severity    *domain.Severity     `gorm:"column:severity"`
	Phase       *string              `gorm:"column:phase"`
	Status      domain.TaskStatus    `gorm:"column:status"`
	Notes       string               `gorm:"column:notes"`
	Location    []byte               `gorm:"column:location"`
	AssignedTo  *uuid.UUID           `gorm:"column:assigned_to"`
	DueDate     *time.Time           `gorm:"column:due_date"`
	CompletedAt *time.Time           `gorm:"column:completed_at"`
	CreatedBy   *uuid.UUID           `gorm:"column:created_by"`
	CreatedAt   time.Time            `gorm:"column:created_at"`
}

func (taskRow) TableName() string { return "tasks" }

type TaskStore struct{ db *gorm.DB }

func NewTaskStore(db *gorm.DB) *TaskStore { return &TaskStore{db: db} }

func (s *TaskStore) Create(p domain.TaskCreateParams) (*domain.Task, error) {
	var dueDate *time.Time
	if p.DueDate != nil && *p.DueDate != "" {
		t, err := time.Parse(time.RFC3339, *p.DueDate)
		if err != nil {
			t2, err2 := time.Parse("2006-01-02", *p.DueDate)
			if err2 != nil {
				return nil, err
			}
			t = t2
		}
		dueDate = &t
	}

	id := uuid.New()
	var locationGeoJSON *string
	if p.Location != nil {
		s := string(p.Location.RawMessage)
		locationGeoJSON = &s
	}

	err := s.db.Exec(`
		INSERT INTO tasks (id, vine_id, vineyard_id, title, record_type, category, severity, phase, status, notes, location, due_date, created_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ST_GeomFromGeoJSON(?), ?, ?)`,
		id, p.VineID, p.VineyardID, p.Title, p.RecordType, p.Category, p.Severity, p.Phase,
		domain.TaskStatusOpen, p.Notes, locationGeoJSON, dueDate, p.CreatedBy,
	).Error
	if err != nil {
		return nil, err
	}
	return s.loadOne(id)
}

func (s *TaskStore) ListByVine(vineID uuid.UUID) ([]domain.Task, error) {
	return s.query("vine_id = ?", vineID)
}

func (s *TaskStore) ListByCreator(userID uuid.UUID) ([]domain.Task, error) {
	return s.query("created_by = ?", userID)
}

func (s *TaskStore) UpdateStatus(id uuid.UUID, status domain.TaskStatus) (*domain.Task, error) {
	updates := map[string]any{"status": status}
	if status == domain.TaskStatusDone {
		updates["completed_at"] = time.Now()
	}
	if err := s.db.Model(&taskRow{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}
	return s.loadOne(id)
}

func (s *TaskStore) Delete(id uuid.UUID) error {
	return s.db.Exec("DELETE FROM tasks WHERE id = ?", id).Error
}

func (s *TaskStore) LatestSprayTask(vineyardID uuid.UUID) (*domain.Task, error) {
	var rows []taskScanRow
	err := s.db.Raw(`
		SELECT id, vine_id, vineyard_id, title, record_type, category, severity, phase, status, notes,
		       assigned_to, due_date, completed_at, created_by, created_at,
		       ST_AsGeoJSON(location) AS location_geojson
		FROM tasks
		WHERE vineyard_id = ? AND category = 'pflanzenschutz'
		ORDER BY created_at DESC
		LIMIT 1`, vineyardID).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	r := rows[0]
	t := domain.Task{
		ID:          r.ID,
		VineID:      r.VineID,
		VineyardID:  r.VineyardID,
		Title:       r.Title,
		RecordType:  r.RecordType,
		Category:    r.Category,
		Severity:    r.Severity,
		Phase:       r.Phase,
		Status:      r.Status,
		Notes:       r.Notes,
		AssignedTo:  r.AssignedTo,
		DueDate:     r.DueDate,
		CompletedAt: r.CompletedAt,
		CreatedBy:   r.CreatedBy,
		CreatedAt:   r.CreatedAt,
	}
	if r.LocationGeoJSON != "" {
		t.Location = &domain.GeoJSON{RawMessage: json.RawMessage(r.LocationGeoJSON)}
	}
	return &t, nil
}

// loadOne fetches a single task with the location rendered as GeoJSON.
func (s *TaskStore) loadOne(id uuid.UUID) (*domain.Task, error) {
	rows, err := s.query("id = ?", id)
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	return &rows[0], nil
}

type taskScanRow struct {
	ID              uuid.UUID           `gorm:"column:id"`
	VineID          *uuid.UUID          `gorm:"column:vine_id"`
	VineyardID      *uuid.UUID          `gorm:"column:vineyard_id"`
	Title           string              `gorm:"column:title"`
	RecordType      domain.RecordType   `gorm:"column:record_type"`
	Category        domain.TaskCategory `gorm:"column:category"`
	Severity        *domain.Severity    `gorm:"column:severity"`
	Phase           *string             `gorm:"column:phase"`
	Status          domain.TaskStatus   `gorm:"column:status"`
	Notes           string              `gorm:"column:notes"`
	AssignedTo      *uuid.UUID          `gorm:"column:assigned_to"`
	DueDate         *time.Time          `gorm:"column:due_date"`
	CompletedAt     *time.Time          `gorm:"column:completed_at"`
	CreatedBy       *uuid.UUID          `gorm:"column:created_by"`
	CreatedAt       time.Time           `gorm:"column:created_at"`
	LocationGeoJSON string              `gorm:"column:location_geojson"`
}

func (s *TaskStore) query(where string, arg any) ([]domain.Task, error) {
	var rows []taskScanRow
	err := s.db.
		Raw(`SELECT id, vine_id, vineyard_id, title, record_type, category, severity, phase, status, notes,
		            assigned_to, due_date, completed_at, created_by, created_at,
		            ST_AsGeoJSON(location) AS location_geojson
		     FROM tasks WHERE `+where+` ORDER BY created_at DESC`, arg).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make([]domain.Task, len(rows))
	for i, r := range rows {
		t := domain.Task{
			ID:          r.ID,
			VineID:      r.VineID,
			VineyardID:  r.VineyardID,
			Title:       r.Title,
			RecordType:  r.RecordType,
			Category:    r.Category,
			Severity:    r.Severity,
			Phase:       r.Phase,
			Status:      r.Status,
			Notes:       r.Notes,
			AssignedTo:  r.AssignedTo,
			DueDate:     r.DueDate,
			CompletedAt: r.CompletedAt,
			CreatedBy:   r.CreatedBy,
			CreatedAt:   r.CreatedAt,
		}
		if r.LocationGeoJSON != "" {
			t.Location = &domain.GeoJSON{RawMessage: json.RawMessage(r.LocationGeoJSON)}
		}
		result[i] = t
	}
	return result, nil
}

