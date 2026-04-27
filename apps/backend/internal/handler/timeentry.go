package handler

import (
	"encoding/json"
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
