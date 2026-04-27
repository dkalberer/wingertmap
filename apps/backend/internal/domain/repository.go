package domain

import "github.com/google/uuid"

// VineyardRepository defines all persistence operations for vineyards.
type VineyardRepository interface {
	Create(name, description string, boundary *GeoJSON, ownerID uuid.UUID) (*Vineyard, error)
	GetByID(id uuid.UUID) (*Vineyard, error)
	ListByOwner(ownerID uuid.UUID) ([]Vineyard, error)
	Update(id uuid.UUID, name, description string, boundary *GeoJSON) error
	Delete(id uuid.UUID) error
}

// RowRepository defines all persistence operations for rows.
type RowRepository interface {
	Create(vineyardID uuid.UUID, rowNumber int, line *GeoJSON, variety string, status RowStatus) (*Row, error)
	BulkCreate(rows []Row) error
	ListByVineyard(vineyardID uuid.UUID) ([]Row, error)
	UpdateStatus(id uuid.UUID, status RowStatus) error
	UpdateLine(id uuid.UUID, line *GeoJSON) error
	Delete(id uuid.UUID) error
	DeleteProposedByVineyard(vineyardID uuid.UUID) error
	NextRowNumber(vineyardID uuid.UUID) (int, error)
}

// VineRepository defines all persistence operations for vines.
type VineRepository interface {
	Create(rowID uuid.UUID, vineNumber int, position *GeoJSON, notes string) (*Vine, error)
	ListByRow(rowID uuid.UUID) ([]Vine, error)
	FindNearby(lat, lng, radiusMeters float64) ([]Vine, error)
}

// GrapeVarietyRepository defines all persistence operations for grape varieties.
type GrapeVarietyRepository interface {
	Create(name, color string, userID uuid.UUID) (*GrapeVariety, error)
	ListByUser(userID uuid.UUID) ([]GrapeVariety, error)
	Delete(id, userID uuid.UUID) error
}

// HarvestCreateParams holds all fields for creating a harvest entry.
type HarvestCreateParams struct {
	VineyardID  uuid.UUID
	VarietyID   uuid.UUID
	HarvestDate string // YYYY-MM-DD
	WeightKg    float64
	Oechsle     *int
	Notes       string
	CreatedBy   uuid.UUID
}

// HarvestUpdateParams holds updatable fields for a harvest entry.
type HarvestUpdateParams struct {
	VarietyID   uuid.UUID
	HarvestDate string
	WeightKg    float64
	Oechsle     *int
	Notes       string
}

// HarvestRepository defines all persistence operations for harvests.
type HarvestRepository interface {
	Create(p HarvestCreateParams) (*Harvest, error)
	ListByVineyard(vineyardID uuid.UUID) ([]Harvest, error)
	Update(id uuid.UUID, p HarvestUpdateParams) (*Harvest, error)
	Delete(id uuid.UUID) error
}

// EmployeeRepository defines all persistence operations for employees.
type EmployeeRepository interface {
	Create(name string, createdBy uuid.UUID) (*Employee, error)
	ListByUser(userID uuid.UUID) ([]Employee, error)
	Delete(id, userID uuid.UUID) error
}

// WorkTypeRepository defines all persistence operations for work types.
type WorkTypeRepository interface {
	Create(name string, createdBy uuid.UUID) (*WorkType, error)
	ListByUser(userID uuid.UUID) ([]WorkType, error)
	Delete(id, userID uuid.UUID) error
}

// TimeEntryCreateParams holds all fields for creating a time entry.
type TimeEntryCreateParams struct {
	EmployeeID  uuid.UUID
	WorkTypeID  *uuid.UUID
	VineyardID  *uuid.UUID
	EntryDate   string // YYYY-MM-DD
	Hours       float64
	Description string
	CreatedBy   uuid.UUID
}

// TimeEntryImportRow represents a single row from a CSV import.
type TimeEntryImportRow struct {
	Date         string  // YYYY-MM-DD
	EmployeeName string
	WorkTypeName string  // optional
	Hours        float64
	Description  string  // optional
}

// TimeEntryImportResult summarises the outcome of a CSV import.
type TimeEntryImportResult struct {
	Imported int      `json:"imported"`
	Skipped  int      `json:"skipped"`
	Errors   []string `json:"errors,omitempty"`
}

// TimeEntryRepository defines all persistence operations for time entries.
type TimeEntryRepository interface {
	Create(p TimeEntryCreateParams) (*TimeEntry, error)
	ListByUser(userID uuid.UUID, year int) ([]TimeEntry, error)
	Delete(id, userID uuid.UUID) error
	StatsByYear(userID uuid.UUID, year int) ([]EmployeeMonthStats, error)
	Import(rows []TimeEntryImportRow, createdBy uuid.UUID) (*TimeEntryImportResult, error)
}

// VintageJournalRepository defines all persistence operations for vintage journals.
type VintageJournalRepository interface {
	ListByVineyard(vineyardID uuid.UUID) ([]VintageJournal, error)
	GetByYear(vineyardID uuid.UUID, year int) (*VintageJournal, error)
	Upsert(vineyardID uuid.UUID, year int, notes string, createdBy uuid.UUID) (*VintageJournal, error)
}

// TaskCreateParams holds all fields for creating a task.
type TaskCreateParams struct {
	VineID     *uuid.UUID
	VineyardID *uuid.UUID
	Title      string
	RecordType RecordType
	Category   TaskCategory
	Severity   *Severity
	Phase      *string
	Notes      string
	Location   *GeoJSON
	DueDate    *string
	CreatedBy  uuid.UUID
}

// TaskRepository defines all persistence operations for tasks.
type TaskRepository interface {
	Create(p TaskCreateParams) (*Task, error)
	ListByVine(vineID uuid.UUID) ([]Task, error)
	ListByCreator(userID uuid.UUID) ([]Task, error)
	UpdateStatus(id uuid.UUID, status TaskStatus) (*Task, error)
	Delete(id uuid.UUID) error
	LatestSprayTask(vineyardID uuid.UUID) (*Task, error)
}

