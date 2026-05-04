package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"wingert/backend/internal/domain"
	"wingert/backend/internal/handler/middleware"
)

type PruningHandler struct{ repo domain.PruningRepository }

func NewPruningHandler(repo domain.PruningRepository) *PruningHandler {
	return &PruningHandler{repo: repo}
}

func (h *PruningHandler) List(w http.ResponseWriter, r *http.Request) {
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

func (h *PruningHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	createdBy, _ := uuid.Parse(claims.UserID)

	vineyardID, err := uuid.Parse(chi.URLParam(r, "vineyardID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid vineyard id")
		return
	}

	var req struct {
		Year         int                `json:"year"`
		PruningDate  string             `json:"pruningDate"`
		SchnittTyp   domain.SchnittTyp  `json:"schnittTyp"`
		AugenProRebe *float64           `json:"augenProRebe"`
		Notes        string             `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if req.Year == 0 || req.PruningDate == "" || req.SchnittTyp == "" {
		writeError(w, http.StatusBadRequest, "year, pruningDate and schnittTyp required")
		return
	}

	record, err := h.repo.Create(domain.PruningCreateParams{
		VineyardID:   vineyardID,
		Year:         req.Year,
		PruningDate:  req.PruningDate,
		SchnittTyp:   req.SchnittTyp,
		AugenProRebe: req.AugenProRebe,
		Notes:        req.Notes,
		CreatedBy:    createdBy,
	})
	if err != nil {
		writeInternalError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, record)
}

func (h *PruningHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	var req struct {
		Year         int                `json:"year"`
		PruningDate  string             `json:"pruningDate"`
		SchnittTyp   domain.SchnittTyp  `json:"schnittTyp"`
		AugenProRebe *float64           `json:"augenProRebe"`
		Notes        string             `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if req.Year == 0 || req.PruningDate == "" || req.SchnittTyp == "" {
		writeError(w, http.StatusBadRequest, "year, pruningDate and schnittTyp required")
		return
	}

	record, err := h.repo.Update(id, domain.PruningUpdateParams{
		Year:         req.Year,
		PruningDate:  req.PruningDate,
		SchnittTyp:   req.SchnittTyp,
		AugenProRebe: req.AugenProRebe,
		Notes:        req.Notes,
	})
	if err != nil {
		writeInternalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, record)
}

func (h *PruningHandler) Delete(w http.ResponseWriter, r *http.Request) {
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
