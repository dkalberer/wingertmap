package handler

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"wingert/backend/internal/domain"
	"wingert/backend/internal/handler/middleware"
)

type TimeEntryHandler struct{ repo domain.TimeEntryRepository }

func NewTimeEntryHandler(repo domain.TimeEntryRepository) *TimeEntryHandler {
	return &TimeEntryHandler{repo: repo}
}

func (h *TimeEntryHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	userID, _ := uuid.Parse(claims.UserID)

	year := time.Now().Year()
	if y := r.URL.Query().Get("year"); y != "" {
		if parsed, err := strconv.Atoi(y); err == nil {
			year = parsed
		}
	}

	list, err := h.repo.ListByUser(userID, year)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *TimeEntryHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	userID, _ := uuid.Parse(claims.UserID)

	var req struct {
		EmployeeID  string  `json:"employeeId"`
		WorkTypeID  string  `json:"workTypeId"`
		VineyardID  string  `json:"vineyardId"`
		EntryDate   string  `json:"entryDate"`
		Hours       float64 `json:"hours"`
		Description string  `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	employeeID, err := uuid.Parse(req.EmployeeID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid employeeId")
		return
	}
	if req.EntryDate == "" || req.Hours <= 0 {
		writeError(w, http.StatusBadRequest, "entryDate and hours required")
		return
	}

	params := domain.TimeEntryCreateParams{
		EmployeeID:  employeeID,
		EntryDate:   req.EntryDate,
		Hours:       req.Hours,
		Description: req.Description,
		CreatedBy:   userID,
	}
	if req.WorkTypeID != "" {
		if id, err := uuid.Parse(req.WorkTypeID); err == nil {
			params.WorkTypeID = &id
		}
	}
	if req.VineyardID != "" {
		if id, err := uuid.Parse(req.VineyardID); err == nil {
			params.VineyardID = &id
		}
	}

	entry, err := h.repo.Create(params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, entry)
}

func (h *TimeEntryHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	userID, _ := uuid.Parse(claims.UserID)
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := h.repo.Delete(id, userID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *TimeEntryHandler) Export(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	userID, _ := uuid.Parse(claims.UserID)

	year := time.Now().Year()
	if y := r.URL.Query().Get("year"); y != "" {
		if parsed, err := strconv.Atoi(y); err == nil {
			year = parsed
		}
	}

	entries, err := h.repo.ListByUser(userID, year)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="stunden_%d.csv"`, year))

	cw := csv.NewWriter(w)
	cw.Write([]string{"Datum", "Mitarbeiter", "Tätigkeit", "Stunden", "Beschreibung"})
	for _, e := range entries {
		workTypeName := ""
		if e.WorkType != nil {
			workTypeName = e.WorkType.Name
		}
		cw.Write([]string{
			e.EntryDate.Format("2006-01-02"),
			e.Employee.Name,
			workTypeName,
			strconv.FormatFloat(e.Hours, 'f', -1, 64),
			e.Description,
		})
	}
	cw.Flush()
}

func (h *TimeEntryHandler) Import(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	userID, _ := uuid.Parse(claims.UserID)

	if err := r.ParseMultipartForm(2 << 20); err != nil { // 2 MB limit
		writeError(w, http.StatusBadRequest, "invalid multipart form")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "file field missing")
		return
	}
	defer file.Close()

	cr := csv.NewReader(file)
	cr.TrimLeadingSpace = true
	records, err := cr.ReadAll()
	if err != nil {
		writeError(w, http.StatusBadRequest, "ungültiges CSV: "+err.Error())
		return
	}
	if len(records) < 2 {
		writeJSON(w, http.StatusOK, &domain.TimeEntryImportResult{})
		return
	}

	// Skip header row, parse data rows.
	rows := make([]domain.TimeEntryImportRow, 0, len(records)-1)
	for _, rec := range records[1:] {
		if len(rec) < 4 {
			continue
		}
		hours, err := strconv.ParseFloat(rec[3], 64)
		if err != nil {
			continue
		}
		desc := ""
		if len(rec) >= 5 {
			desc = rec[4]
		}
		rows = append(rows, domain.TimeEntryImportRow{
			Date:         rec[0],
			EmployeeName: rec[1],
			WorkTypeName: rec[2],
			Hours:        hours,
			Description:  desc,
		})
	}

	result, err := h.repo.Import(rows, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *TimeEntryHandler) Stats(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	userID, _ := uuid.Parse(claims.UserID)

	year := time.Now().Year()
	if y := r.URL.Query().Get("year"); y != "" {
		if parsed, err := strconv.Atoi(y); err == nil {
			year = parsed
		}
	}

	stats, err := h.repo.StatsByYear(userID, year)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, stats)
}
