package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"wingert/backend/internal/domain"
)

type VineHandler struct{ repo domain.VineRepository }

func NewVineHandler(repo domain.VineRepository) *VineHandler { return &VineHandler{repo: repo} }

func (h *VineHandler) List(w http.ResponseWriter, r *http.Request) {
	rowID, err := uuid.Parse(chi.URLParam(r, "rowID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid row id")
		return
	}
	vines, err := h.repo.ListByRow(rowID)
	if err != nil {
		writeInternalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, vines)
}

func (h *VineHandler) Create(w http.ResponseWriter, r *http.Request) {
	rowID, err := uuid.Parse(chi.URLParam(r, "rowID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid row id")
		return
	}
	var req struct {
		VineNumber int             `json:"vineNumber"`
		Position   *domain.GeoJSON `json:"position"`
		Notes      string          `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	vine, err := h.repo.Create(rowID, req.VineNumber, req.Position, req.Notes)
	if err != nil {
		writeInternalError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, vine)
}

func (h *VineHandler) Nearby(w http.ResponseWriter, r *http.Request) {
	lat, err1 := strconv.ParseFloat(r.URL.Query().Get("lat"), 64)
	lng, err2 := strconv.ParseFloat(r.URL.Query().Get("lng"), 64)
	radius, err3 := strconv.ParseFloat(r.URL.Query().Get("radius"), 64)
	if err1 != nil || err2 != nil || err3 != nil {
		writeError(w, http.StatusBadRequest, "lat, lng and radius are required")
		return
	}
	vines, err := h.repo.FindNearby(lat, lng, radius)
	if err != nil {
		writeInternalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, vines)
}
