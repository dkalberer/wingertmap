package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"wingert/backend/internal/protection"
)

type DiseaseHandler struct{ svc *protection.RiskService }

func NewDiseaseHandler(svc *protection.RiskService) *DiseaseHandler {
	return &DiseaseHandler{svc: svc}
}

func (h *DiseaseHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	res, err := h.svc.Compute(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, res)
}
