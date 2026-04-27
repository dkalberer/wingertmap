package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"wingert/backend/internal/domain"
	"wingert/backend/internal/handler/middleware"
)

type VineyardHandler struct{ repo domain.VineyardRepository }

func NewVineyardHandler(repo domain.VineyardRepository) *VineyardHandler {
	return &VineyardHandler{repo: repo}
}

func (h *VineyardHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	ownerID, _ := uuid.Parse(claims.UserID)
	list, err := h.repo.ListByOwner(ownerID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *VineyardHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	ownerID, _ := uuid.Parse(claims.UserID)
	var req struct {
		Name        string          `json:"name"`
		Description string          `json:"description"`
		Boundary    *domain.GeoJSON `json:"boundary"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	v, err := h.repo.Create(req.Name, req.Description, req.Boundary, ownerID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, v)
}

func (h *VineyardHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	v, err := h.repo.GetByID(id)
	if err != nil {
		writeError(w, http.StatusNotFound, "vineyard not found")
		return
	}
	writeJSON(w, http.StatusOK, v)
}

func (h *VineyardHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req struct {
		Name        string          `json:"name"`
		Description string          `json:"description"`
		Boundary    *domain.GeoJSON `json:"boundary"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if err := h.repo.Update(id, req.Name, req.Description, req.Boundary); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	v, _ := h.repo.GetByID(id)
	writeJSON(w, http.StatusOK, v)
}

func (h *VineyardHandler) Delete(w http.ResponseWriter, r *http.Request) {
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
