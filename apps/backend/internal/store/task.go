package store

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
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

	status := domain.TaskStatusOpen
	if p.Status != nil {
		status = *p.Status
	}
	err := s.db.Exec(`
		INSERT INTO tasks (id, vine_id, vineyard_id, title, record_type, category, severity, phase, status, notes, location, due_date, created_by, subtype, completed_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ST_GeomFromGeoJSON(?), ?, ?, ?, ?)`,
		id, p.VineID, p.VineyardID, p.Title, p.RecordType, p.Category, p.Severity, p.Phase,
		status, p.Notes, locationGeoJSON, dueDate, p.CreatedBy, p.Subtype, p.CompletedAt,
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
		       assigned_to, due_date, completed_at, created_by, created_at, subtype,
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
		Subtype:     r.Subtype,
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
	Subtype         *string             `gorm:"column:subtype"`
	LocationGeoJSON string              `gorm:"column:location_geojson"`
}

func (s *TaskStore) query(where string, arg any) ([]domain.Task, error) {
	var rows []taskScanRow
	err := s.db.
		Raw(`SELECT id, vine_id, vineyard_id, title, record_type, category, severity, phase, status, notes,
		            assigned_to, due_date, completed_at, created_by, created_at, subtype,
		            ST_AsGeoJSON(location) AS location_geojson
		     FROM tasks WHERE `+where+` ORDER BY created_at DESC`, arg).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make([]domain.Task, len(rows))
	taskIDs := make([]uuid.UUID, 0, len(rows))
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
			Subtype:     r.Subtype,
		}
		if r.LocationGeoJSON != "" {
			t.Location = &domain.GeoJSON{RawMessage: json.RawMessage(r.LocationGeoJSON)}
		}
		result[i] = t
		taskIDs = append(taskIDs, r.ID)
	}
	if len(taskIDs) > 0 {
		sprays, err := s.loadSpraysForTasks(taskIDs)
		if err != nil {
			return nil, err
		}
		for i := range result {
			if sp, ok := sprays[result[i].ID]; ok {
				s := sp
				result[i].Spray = &s
			}
		}
	}
	return result, nil
}

func (s *TaskStore) loadSpraysForTasks(taskIDs []uuid.UUID) (map[uuid.UUID]domain.SprayApplication, error) {
	var rows []struct {
		TaskID       uuid.UUID      `gorm:"column:task_id"`
		ProductIDs   pq.StringArray `gorm:"column:product_ids"`
		ProductNames pq.StringArray `gorm:"column:product_names"`
		Dosage       *float64       `gorm:"column:dosage"`
		DosageUnit   string         `gorm:"column:dosage_unit"`
		AppliedAt    time.Time      `gorm:"column:applied_at"`
	}
	err := s.db.Raw(`
		SELECT sa.task_id,
		       sa.product_ids,
		       (SELECT COALESCE(array_agg(p.name ORDER BY p.name), '{}')
		          FROM psm_products p
		          WHERE p.id = ANY(sa.product_ids)) AS product_names,
		       sa.dosage,
		       sa.dosage_unit,
		       sa.applied_at
		FROM spray_applications sa
		WHERE sa.task_id IN (?)`, taskIDs).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make(map[uuid.UUID]domain.SprayApplication, len(rows))
	for _, r := range rows {
		out[r.TaskID] = domain.SprayApplication{
			TaskID:       r.TaskID,
			ProductIDs:   []string(r.ProductIDs),
			ProductNames: []string(r.ProductNames),
			Dosage:       r.Dosage,
			DosageUnit:   r.DosageUnit,
			AppliedAt:    r.AppliedAt,
		}
	}
	return out, nil
}

