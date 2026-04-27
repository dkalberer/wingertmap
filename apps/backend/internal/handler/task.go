package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"wingert/backend/internal/domain"
	"wingert/backend/internal/handler/middleware"
)

type TaskHandler struct{ repo domain.TaskRepository }

func NewTaskHandler(repo domain.TaskRepository) *TaskHandler { return &TaskHandler{repo: repo} }

func (h *TaskHandler) List(w http.ResponseWriter, r *http.Request) {
	vineID, err := uuid.Parse(chi.URLParam(r, "vineID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid vine id")
		return
	}
	tasks, err := h.repo.ListByVine(vineID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
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
	}
	if req.Location != nil {
		p.Location = &domain.GeoJSON{RawMessage: *req.Location}
	}
	if req.VineyardID != nil {
		id, err := uuid.Parse(*req.VineyardID)
		if err == nil {
			p.VineyardID = &id
		}
	}

	task, err := h.repo.Create(p)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, task)
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
		writeError(w, http.StatusInternalServerError, err.Error())
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
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *TaskHandler) All(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	userID, _ := uuid.Parse(claims.UserID)
	tasks, err := h.repo.ListByCreator(userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, tasks)
}
