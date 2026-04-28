package store

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"wingert/backend/internal/domain"
)

type timeEntryScanRow struct {
	ID              uuid.UUID  `gorm:"column:id"`
	EmployeeID      uuid.UUID  `gorm:"column:employee_id"`
	EmployeeName    string     `gorm:"column:employee_name"`
	WorkTypeID      *uuid.UUID `gorm:"column:work_type_id"`
	WorkTypeName    string     `gorm:"column:work_type_name"`
	VineyardID      *uuid.UUID `gorm:"column:vineyard_id"`
	EntryDate       time.Time  `gorm:"column:entry_date"`
	Hours           float64    `gorm:"column:hours"`
	Description     string     `gorm:"column:description"`
	CreatedBy       uuid.UUID  `gorm:"column:created_by"`
	CreatedAt       time.Time  `gorm:"column:created_at"`
}

type monthStatRow struct {
	EmployeeID   uuid.UUID `gorm:"column:employee_id"`
	EmployeeName string    `gorm:"column:employee_name"`
	Month        int       `gorm:"column:month"`
	Hours        float64   `gorm:"column:hours"`
}

type TimeEntryStore struct{ db *gorm.DB }

func NewTimeEntryStore(db *gorm.DB) *TimeEntryStore { return &TimeEntryStore{db: db} }

func (s *TimeEntryStore) Create(p domain.TimeEntryCreateParams) (*domain.TimeEntry, error) {
	id := uuid.New()
	err := s.db.Exec(`
		INSERT INTO time_entries (id, employee_id, work_type_id, vineyard_id, entry_date, hours, description, created_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		id, p.EmployeeID, p.WorkTypeID, p.VineyardID, p.EntryDate, p.Hours, p.Description, p.CreatedBy,
	).Error
	if err != nil {
		return nil, err
	}
	return s.loadOne(id)
}

func (s *TimeEntryStore) ListByUser(userID uuid.UUID, year int) ([]domain.TimeEntry, error) {
	var rows []timeEntryScanRow
	err := s.db.Raw(`
		SELECT te.id, te.employee_id, e.name AS employee_name,
		       te.work_type_id, wt.name AS work_type_name,
		       te.vineyard_id, te.entry_date, te.hours, te.description,
		       te.created_by, te.created_at
		FROM time_entries te
		JOIN employees e ON e.id = te.employee_id
		LEFT JOIN work_types wt ON wt.id = te.work_type_id
		WHERE te.created_by = ? AND EXTRACT(YEAR FROM te.entry_date) = ?
		ORDER BY te.entry_date DESC`,
		userID, year,
	).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make([]domain.TimeEntry, len(rows))
	for i, r := range rows {
		result[i] = toTimeEntry(r)
	}
	return result, nil
}

func (s *TimeEntryStore) Delete(id, userID uuid.UUID) error {
	return s.db.Exec(`DELETE FROM time_entries WHERE id = ? AND created_by = ?`, id, userID).Error
}

func (s *TimeEntryStore) StatsByYear(userID uuid.UUID, year int) ([]domain.EmployeeMonthStats, error) {
	// First get active (non-deleted) employees for this user.
	var empRows []employeeScanRow
	err := s.db.Raw(
		`SELECT id, name, created_by, created_at FROM employees WHERE created_by = ? AND deleted_at IS NULL ORDER BY name`,
		userID,
	).Scan(&empRows).Error
	if err != nil {
		return nil, err
	}

	// Get monthly sums
	var monthRows []monthStatRow
	err = s.db.Raw(`
		SELECT e.id AS employee_id, e.name AS employee_name,
		       EXTRACT(MONTH FROM te.entry_date)::int AS month,
		       SUM(te.hours) AS hours
		FROM employees e
		JOIN time_entries te ON te.employee_id = e.id
		WHERE e.created_by = ? AND EXTRACT(YEAR FROM te.entry_date) = ?
		GROUP BY e.id, e.name, month
		ORDER BY e.name`,
		userID, year,
	).Scan(&monthRows).Error
	if err != nil {
		return nil, err
	}

	// Build stats map: active employees are pre-seeded with zeros so they always
	// appear even without entries. Deleted employees surface via monthRows only.
	statsMap := make(map[uuid.UUID]*domain.EmployeeMonthStats)
	for _, e := range empRows {
		statsMap[e.ID] = &domain.EmployeeMonthStats{
			EmployeeID:   e.ID,
			EmployeeName: e.Name,
		}
	}
	for _, r := range monthRows {
		if _, ok := statsMap[r.EmployeeID]; !ok {
			// Deleted employee that still has time entries — include them.
			statsMap[r.EmployeeID] = &domain.EmployeeMonthStats{
				EmployeeID:   r.EmployeeID,
				EmployeeName: r.EmployeeName,
			}
		}
		if r.Month >= 1 && r.Month <= 12 {
			statsMap[r.EmployeeID].Months[r.Month-1] = r.Hours
			statsMap[r.EmployeeID].Total += r.Hours
		}
	}

	// Maintain stable order: active employees alphabetically first, then deleted.
	result := make([]domain.EmployeeMonthStats, 0, len(statsMap))
	for _, e := range empRows {
		result = append(result, *statsMap[e.ID])
	}
	for empID, s := range statsMap {
		found := false
		for _, e := range empRows {
			if e.ID == empID {
				found = true
				break
			}
		}
		if !found {
			result = append(result, *s)
		}
	}
	return result, nil
}

func (s *TimeEntryStore) loadOne(id uuid.UUID) (*domain.TimeEntry, error) {
	var rows []timeEntryScanRow
	err := s.db.Raw(`
		SELECT te.id, te.employee_id, e.name AS employee_name,
		       te.work_type_id, wt.name AS work_type_name,
		       te.vineyard_id, te.entry_date, te.hours, te.description,
		       te.created_by, te.created_at
		FROM time_entries te
		JOIN employees e ON e.id = te.employee_id
		LEFT JOIN work_types wt ON wt.id = te.work_type_id
		WHERE te.id = ?`, id,
	).Scan(&rows).Error
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	entry := toTimeEntry(rows[0])
	return &entry, nil
}

func (s *TimeEntryStore) Import(rows []domain.TimeEntryImportRow, createdBy uuid.UUID) (*domain.TimeEntryImportResult, error) {
	// Build name→ID maps for employees and work types owned by this user.
	var empRows []employeeScanRow
	if err := s.db.Raw(`SELECT id, name, created_by, created_at FROM employees WHERE created_by = ?`, createdBy).Scan(&empRows).Error; err != nil {
		return nil, err
	}
	empMap := make(map[string]uuid.UUID, len(empRows))
	for _, e := range empRows {
		empMap[e.Name] = e.ID
	}

	var wtRows []workTypeScanRow
	if err := s.db.Raw(`SELECT id, name, created_by, created_at FROM work_types WHERE created_by = ?`, createdBy).Scan(&wtRows).Error; err != nil {
		return nil, err
	}
	wtMap := make(map[string]uuid.UUID, len(wtRows))
	for _, wt := range wtRows {
		wtMap[wt.Name] = wt.ID
	}

	result := &domain.TimeEntryImportResult{}
	for i, row := range rows {
		lineNum := i + 2 // header is line 1
		empID, ok := empMap[row.EmployeeName]
		if !ok {
			result.Errors = append(result.Errors, fmt.Sprintf("Zeile %d: Mitarbeiter %q nicht gefunden", lineNum, row.EmployeeName))
			result.Skipped++
			continue
		}
		if row.Hours <= 0 {
			result.Errors = append(result.Errors, fmt.Sprintf("Zeile %d: ungültige Stunden", lineNum))
			result.Skipped++
			continue
		}

		params := domain.TimeEntryCreateParams{
			EmployeeID:  empID,
			EntryDate:   row.Date,
			Hours:       row.Hours,
			Description: row.Description,
			CreatedBy:   createdBy,
		}
		if row.WorkTypeName != "" {
			if id, ok := wtMap[row.WorkTypeName]; ok {
				params.WorkTypeID = &id
			}
		}

		if _, err := s.Create(params); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Zeile %d: %v", lineNum, err))
			result.Skipped++
			continue
		}
		result.Imported++
	}
	return result, nil
}

func toTimeEntry(r timeEntryScanRow) domain.TimeEntry {
	e := domain.TimeEntry{
		ID:          r.ID,
		EmployeeID:  r.EmployeeID,
		VineyardID:  r.VineyardID,
		EntryDate:   r.EntryDate,
		Hours:       r.Hours,
		Description: r.Description,
		CreatedBy:   r.CreatedBy,
		CreatedAt:   r.CreatedAt,
	}
	e.Employee = &domain.Employee{ID: r.EmployeeID, Name: r.EmployeeName}
	if r.WorkTypeID != nil {
		e.WorkTypeID = r.WorkTypeID
		e.WorkType = &domain.WorkType{ID: *r.WorkTypeID, Name: r.WorkTypeName}
	}
	return e
}
