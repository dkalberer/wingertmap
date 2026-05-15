package domain

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// GeoJSON is a raw JSON geometry value stored/retrieved from PostGIS.
type GeoJSON struct{ json.RawMessage }

// --- User ---

type User struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"createdAt"`

	PasswordHash string `json:"-"`
}

// --- Vineyard ---

type Vineyard struct {
	ID          uuid.UUID  `json:"id"`
	Name        string     `json:"name"`
	Description string     `json:"description,omitempty"`
	Boundary    *GeoJSON   `json:"boundary,omitempty"`
	OwnerID     *uuid.UUID `json:"ownerId,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
}

// --- Row ---

type RowStatus string

const (
	RowStatusProposed  RowStatus = "proposed"
	RowStatusConfirmed RowStatus = "confirmed"
)

type Row struct {
	ID           uuid.UUID  `json:"id"`
	VineyardID   uuid.UUID  `json:"vineyardId"`
	RowNumber    int        `json:"rowNumber"`
	Line         *GeoJSON   `json:"line,omitempty"`
	Variety      string     `json:"variety,omitempty"`
	Status       RowStatus  `json:"status"`
	CreatedAt  time.Time `json:"createdAt"`
}

// --- Vine ---

type Vine struct {
	ID         uuid.UUID  `json:"id"`
	RowID      uuid.UUID  `json:"rowId"`
	VineNumber int        `json:"vineNumber"`
	Position   *GeoJSON   `json:"position,omitempty"`
	Notes      string     `json:"notes,omitempty"`
	CreatedAt  time.Time  `json:"createdAt"`
}

// --- GrapeVariety ---

type GrapeVariety struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Color     string    `json:"color"` // weiss | rot | rose
	CreatedBy uuid.UUID `json:"createdBy"`
	CreatedAt time.Time `json:"createdAt"`
}

// --- Harvest ---

type Harvest struct {
	ID          uuid.UUID     `json:"id"`
	VineyardID  uuid.UUID     `json:"vineyardId"`
	VarietyID   uuid.UUID     `json:"varietyId"`
	Variety     *GrapeVariety `json:"variety,omitempty"`
	HarvestDate time.Time     `json:"harvestDate"`
	WeightKg    float64       `json:"weightKg"`
	Oechsle     *int          `json:"oechsle,omitempty"`
	Notes       string        `json:"notes,omitempty"`
	CreatedBy   uuid.UUID     `json:"createdBy"`
	CreatedAt   time.Time     `json:"createdAt"`
}

// --- Employee / WorkType / TimeEntry ---

type Employee struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	CreatedBy uuid.UUID `json:"createdBy"`
	CreatedAt time.Time `json:"createdAt"`
}

type WorkType struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	CreatedBy uuid.UUID `json:"createdBy"`
	CreatedAt time.Time `json:"createdAt"`
}

type TimeEntry struct {
	ID          uuid.UUID  `json:"id"`
	EmployeeID  uuid.UUID  `json:"employeeId"`
	Employee    *Employee  `json:"employee,omitempty"`
	WorkTypeID  *uuid.UUID `json:"workTypeId,omitempty"`
	WorkType    *WorkType  `json:"workType,omitempty"`
	VineyardID  *uuid.UUID `json:"vineyardId,omitempty"`
	EntryDate   time.Time  `json:"entryDate"`
	Hours       float64    `json:"hours"`
	Description string     `json:"description,omitempty"`
	CreatedBy   uuid.UUID  `json:"createdBy"`
	CreatedAt   time.Time  `json:"createdAt"`
}

// EmployeeMonthStats holds monthly hour breakdowns per employee for a given year.
type EmployeeMonthStats struct {
	EmployeeID   uuid.UUID   `json:"employeeId"`
	EmployeeName string      `json:"employeeName"`
	Months       [12]float64 `json:"months"` // index 0 = Jan, 11 = Dez
	Total        float64     `json:"total"`
}

// --- VintageJournal ---

type VintageJournal struct {
	ID         uuid.UUID `json:"id"`
	VineyardID uuid.UUID `json:"vineyardId"`
	Year       int       `json:"year"`
	Notes      string    `json:"notes"`
	CreatedBy  uuid.UUID `json:"createdBy"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

// --- PruningRecord ---

type SchnittTyp string

const (
	SchnittTypBogen     SchnittTyp = "Bogenschnitt"
	SchnittTypZapfen    SchnittTyp = "Zapfenschnitt"
	SchnittTypMinimal   SchnittTyp = "Minimalschnitt"
	SchnittTypSonstiges SchnittTyp = "Sonstiges"
)

type PruningRecord struct {
	ID           uuid.UUID  `json:"id"`
	VineyardID   uuid.UUID  `json:"vineyardId"`
	Year         int        `json:"year"`
	PruningDate  time.Time  `json:"pruningDate"`
	SchnittTyp   SchnittTyp `json:"schnittTyp"`
	AugenProRebe *float64   `json:"augenProRebe,omitempty"`
	Notes        string     `json:"notes,omitempty"`
	CreatedBy    uuid.UUID  `json:"createdBy"`
	CreatedAt    time.Time  `json:"createdAt"`
}

// --- Task ---

type TaskStatus string

const (
	TaskStatusOpen TaskStatus = "offen"
	TaskStatusDone TaskStatus = "erledigt"
)

type RecordType string

const (
	RecordTypeAufgabe     RecordType = "aufgabe"
	RecordTypeBeobachtung RecordType = "beobachtung"
)

type TaskCategory string

const (
	CategoryPflanzenschutz TaskCategory = "pflanzenschutz"
	CategoryRebenpflege    TaskCategory = "rebenpflege"
	CategoryInfrastruktur  TaskCategory = "infrastruktur"
	CategoryBoden          TaskCategory = "boden"
	CategoryPhaenologie    TaskCategory = "phaenologie"
	CategorySonstiges      TaskCategory = "sonstiges"
)

type Severity string

const (
	SeverityNiedrig Severity = "niedrig"
	SeverityMittel  Severity = "mittel"
	SeverityHoch    Severity = "hoch"
)

type Task struct {
	ID          uuid.UUID    `json:"id"`
	VineID      *uuid.UUID   `json:"vineId,omitempty"`
	VineyardID  *uuid.UUID   `json:"vineyardId,omitempty"`
	Title       string       `json:"title"`
	RecordType  RecordType   `json:"recordType"`
	Category    TaskCategory `json:"category"`
	Severity    *Severity    `json:"severity,omitempty"`
	Phase       *string      `json:"phase,omitempty"`
	Status      TaskStatus   `json:"status"`
	Notes       string       `json:"notes,omitempty"`
	Location    *GeoJSON     `json:"location,omitempty"`
	AssignedTo  *uuid.UUID   `json:"assignedTo,omitempty"`
	DueDate     *time.Time   `json:"dueDate,omitempty"`
	CompletedAt *time.Time   `json:"completedAt,omitempty"`
	CreatedBy   *uuid.UUID        `json:"createdBy,omitempty"`
	CreatedAt   time.Time         `json:"createdAt"`
	Subtype     *string           `json:"subtype,omitempty"`
	Spray       *SprayApplication `json:"spray,omitempty"`
}

