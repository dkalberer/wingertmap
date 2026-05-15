package handler

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"wingert/backend/internal/domain"
)

type PSMHandler struct{ repo domain.PSMRepository }

func NewPSMHandler(repo domain.PSMRepository) *PSMHandler {
	return &PSMHandler{repo: repo}
}

func (h *PSMHandler) SearchProducts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	items, err := h.repo.SearchProducts(q, limit)
	if err != nil {
		writeInternalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *PSMHandler) GetProduct(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	p, err := h.repo.GetProduct(id)
	if err != nil {
		writeInternalError(w, err)
		return
	}
	if p == nil {
		writeError(w, http.StatusNotFound, "product not found")
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (h *PSMHandler) SearchSubstances(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	items, err := h.repo.SearchSubstances(q, limit)
	if err != nil {
		writeInternalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}
