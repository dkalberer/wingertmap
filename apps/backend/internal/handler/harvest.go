package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"wingert/backend/internal/domain"
	"wingert/backend/internal/handler/middleware"
)

type HarvestHandler struct{ repo domain.HarvestRepository }

func NewHarvestHandler(repo domain.HarvestRepository) *HarvestHandler {
	return &HarvestHandler{repo: repo}
}

func (h *HarvestHandler) List(w http.ResponseWriter, r *http.Request) {
	vineyardID, err := uuid.Parse(chi.URLParam(r, "vineyardID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid vineyard id")
		return
	}
	list, err := h.repo.ListByVineyard(vineyardID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *HarvestHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	createdBy, _ := uuid.Parse(claims.UserID)

	vineyardID, err := uuid.Parse(chi.URLParam(r, "vineyardID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid vineyard id")
		return
	}

	var req struct {
		VarietyID   string  `json:"varietyId"`
		HarvestDate string  `json:"harvestDate"`
		WeightKg    float64 `json:"weightKg"`
		Oechsle     *int    `json:"oechsle"`
		Notes       string  `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	varietyID, err := uuid.Parse(req.VarietyID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid variety id")
		return
	}
	if req.HarvestDate == "" || req.WeightKg <= 0 {
		writeError(w, http.StatusBadRequest, "harvestDate and weightKg required")
		return
	}

	entry, err := h.repo.Create(domain.HarvestCreateParams{
		VineyardID:  vineyardID,
		VarietyID:   varietyID,
		HarvestDate: req.HarvestDate,
		WeightKg:    req.WeightKg,
		Oechsle:     req.Oechsle,
		Notes:       req.Notes,
		CreatedBy:   createdBy,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, entry)
}

func (h *HarvestHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	var req struct {
		VarietyID   string  `json:"varietyId"`
		HarvestDate string  `json:"harvestDate"`
		WeightKg    float64 `json:"weightKg"`
		Oechsle     *int    `json:"oechsle"`
		Notes       string  `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	varietyID, err := uuid.Parse(req.VarietyID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid variety id")
		return
	}

	entry, err := h.repo.Update(id, domain.HarvestUpdateParams{
		VarietyID:   varietyID,
		HarvestDate: req.HarvestDate,
		WeightKg:    req.WeightKg,
		Oechsle:     req.Oechsle,
		Notes:       req.Notes,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, entry)
}

func (h *HarvestHandler) Delete(w http.ResponseWriter, r *http.Request) {
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
