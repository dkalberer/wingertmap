package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"wingert/backend/internal/domain"
	"wingert/backend/internal/handler/middleware"
)

type JournalHandler struct{ repo domain.VintageJournalRepository }

func NewJournalHandler(repo domain.VintageJournalRepository) *JournalHandler {
	return &JournalHandler{repo: repo}
}

func (h *JournalHandler) List(w http.ResponseWriter, r *http.Request) {
	vineyardID, err := uuid.Parse(chi.URLParam(r, "vineyardID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid vineyard id")
		return
	}
	list, err := h.repo.ListByVineyard(vineyardID)
	if err != nil {
		writeInternalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *JournalHandler) GetByYear(w http.ResponseWriter, r *http.Request) {
	vineyardID, err := uuid.Parse(chi.URLParam(r, "vineyardID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid vineyard id")
		return
	}
	year, err := strconv.Atoi(chi.URLParam(r, "year"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid year")
		return
	}
	j, err := h.repo.GetByYear(vineyardID, year)
	if err != nil {
		writeInternalError(w, err)
		return
	}
	if j == nil {
		writeJSON(w, http.StatusOK, nil)
		return
	}
	writeJSON(w, http.StatusOK, j)
}

func (h *JournalHandler) Upsert(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	createdBy, _ := uuid.Parse(claims.UserID)

	vineyardID, err := uuid.Parse(chi.URLParam(r, "vineyardID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid vineyard id")
		return
	}
	year, err := strconv.Atoi(chi.URLParam(r, "year"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid year")
		return
	}

	var req struct {
		Notes string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	j, err := h.repo.Upsert(vineyardID, year, req.Notes, createdBy)
	if err != nil {
		writeInternalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, j)
}
