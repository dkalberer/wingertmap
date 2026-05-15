package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"wingert/backend/internal/domain"
	"wingert/backend/internal/handler/middleware"
	"wingert/backend/internal/protection"
)

type TaskHandler struct {
	repo    domain.TaskRepository
	sprays  domain.SprayRepository
	periods *protection.PeriodWriter
}

func NewTaskHandler(repo domain.TaskRepository, sprays domain.SprayRepository, periods *protection.PeriodWriter) *TaskHandler {
	return &TaskHandler{repo: repo, sprays: sprays, periods: periods}
}

func (h *TaskHandler) List(w http.ResponseWriter, r *http.Request) {
	vineID, err := uuid.Parse(chi.URLParam(r, "vineID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid vine id")
		return
	}
	tasks, err := h.repo.ListByVine(vineID)
	if err != nil {
		writeInternalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, tasks)
}

// Create handles POST /api/tasks — location-based task without a vine.
func (h *TaskHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	createdBy, _ := uuid.Parse(claims.UserID)

	var req struct {
		Title      string           `json:"title"`
		RecordType string           `json:"recordType"`
		Category   string           `json:"category"`
		Severity   *string          `json:"severity"`
		Phase      *string          `json:"phase"`
		Notes      string           `json:"notes"`
		DueDate    *string          `json:"dueDate"`
		Location   *json.RawMessage `json:"location"`
		VineyardID *string          `json:"vineyardId"`
		Subtype    *string          `json:"subtype"`
		Spray      *struct {
			ProductIDs    []string `json:"productIds"`
			SubstanceIDs  []string `json:"substanceIds"`
			TargetPestIDs []string `json:"targetPestIds"`
			Dosage        *float64 `json:"dosage"`
			DosageUnit    string   `json:"dosageUnit"`
			Notes         string   `json:"notes"`
		} `json:"spray"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	recordType := domain.RecordType(req.RecordType)
	if recordType == "" {
		recordType = domain.RecordTypeAufgabe
	}
	category := domain.TaskCategory(req.Category)
	if category == "" {
		category = domain.CategorySonstiges
	}

	var severity *domain.Severity
	if req.Severity != nil && recordType == domain.RecordTypeBeobachtung {
		s := domain.Severity(*req.Severity)
		severity = &s
	}

	p := domain.TaskCreateParams{
		Title:      req.Title,
		RecordType: recordType,
		Category:   category,
		Severity:   severity,
		Phase:      req.Phase,
		Notes:      req.Notes,
		DueDate:    req.DueDate,
		CreatedBy:  createdBy,
		Subtype:    req.Subtype,
	}
	if req.Location != nil {
		p.Location = &domain.GeoJSON{RawMessage: *req.Location}
	}
	if req.VineyardID != nil {
		if id, err := uuid.Parse(*req.VineyardID); err == nil {
			p.VineyardID = &id
		}
	}

	// Pflanzenschutz-Massnahmen sind durchgeführte Aktionen — direkt als
	// erledigt anlegen. Das vom User gewählte Datum (DueDate-Feld im Form)
	// wird sowohl als due_date als auch als completed_at gesetzt, damit
	// Backdatieren funktioniert.
	if req.Subtype != nil && *req.Subtype != "" {
		done := domain.TaskStatusDone
		p.Status = &done
		completedAt := time.Now()
		if req.DueDate != nil && *req.DueDate != "" {
			if t, err := time.Parse(time.RFC3339, *req.DueDate); err == nil {
				completedAt = t
			} else if t, err := time.Parse("2006-01-02", *req.DueDate); err == nil {
				completedAt = t
			}
		}
		p.CompletedAt = &completedAt
	}

	task, err := h.repo.Create(p)
	if err != nil {
		writeInternalError(w, err)
		return
	}

	if err := h.periods.OnTaskCreated(task); err != nil {
		writeInternalError(w, err)
		return
	}

	if req.Spray != nil && req.Subtype != nil && *req.Subtype == "spritzung" {
		substanceIDs := parseUUIDs(req.Spray.SubstanceIDs)
		targets := parseUUIDs(req.Spray.TargetPestIDs)
		if err := h.sprays.Create(domain.SprayApplication{
			TaskID:        task.ID,
			ProductIDs:    req.Spray.ProductIDs,
			SubstanceIDs:  substanceIDs,
			TargetPestIDs: targets,
			Dosage:        req.Spray.Dosage,
			DosageUnit:    req.Spray.DosageUnit,
			AppliedAt:     task.CreatedAt,
			Notes:         req.Spray.Notes,
		}); err != nil {
			writeInternalError(w, err)
			return
		}
	}

	writeJSON(w, http.StatusCreated, task)
}

func parseUUIDs(in []string) []uuid.UUID {
	out := make([]uuid.UUID, 0, len(in))
	for _, s := range in {
		if u, err := uuid.Parse(s); err == nil {
			out = append(out, u)
		}
	}
	return out
}

func (h *TaskHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req struct {
		Status domain.TaskStatus `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	task, err := h.repo.UpdateStatus(id, req.Status)
	if err != nil {
		writeInternalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, task)
}

func (h *TaskHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := h.repo.Delete(id); err != nil {
		writeInternalError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *TaskHandler) All(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	userID, _ := uuid.Parse(claims.UserID)
	tasks, err := h.repo.ListByCreator(userID)
	if err != nil {
		writeInternalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, tasks)
}
