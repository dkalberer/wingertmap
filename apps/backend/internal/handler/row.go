package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"wingert/backend/internal/domain"
)

type RowHandler struct{ repo domain.RowRepository }

func NewRowHandler(repo domain.RowRepository) *RowHandler { return &RowHandler{repo: repo} }

func (h *RowHandler) List(w http.ResponseWriter, r *http.Request) {
	vineyardID, err := uuid.Parse(chi.URLParam(r, "vineyardID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid vineyard id")
		return
	}
	rows, err := h.repo.ListByVineyard(vineyardID)
	if err != nil {
		writeInternalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, rows)
}

func (h *RowHandler) Create(w http.ResponseWriter, r *http.Request) {
	vineyardID, err := uuid.Parse(chi.URLParam(r, "vineyardID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid vineyard id")
		return
	}
	var req struct {
		RowNumber int             `json:"rowNumber"`
		Line      *domain.GeoJSON `json:"line"`
		Variety   string          `json:"variety"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	rowNum := req.RowNumber
	if rowNum == 0 {
		rowNum, err = h.repo.NextRowNumber(vineyardID)
		if err != nil {
			writeInternalError(w, err)
			return
		}
	}
	row, err := h.repo.Create(vineyardID, rowNum, req.Line, req.Variety, domain.RowStatusConfirmed)
	if err != nil {
		writeInternalError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, row)
}

func (h *RowHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req struct {
		Status domain.RowStatus `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if req.Status != domain.RowStatusProposed && req.Status != domain.RowStatusConfirmed {
		writeError(w, http.StatusBadRequest, "invalid status")
		return
	}
	if err := h.repo.UpdateStatus(id, req.Status); err != nil {
		writeInternalError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *RowHandler) UpdateLine(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req struct {
		Line *domain.GeoJSON `json:"line"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if err := h.repo.UpdateLine(id, req.Line); err != nil {
		writeInternalError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *RowHandler) ConfirmAll(w http.ResponseWriter, r *http.Request) {
	vineyardID, err := uuid.Parse(chi.URLParam(r, "vineyardID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid vineyard id")
		return
	}
	rows, err := h.repo.ListByVineyard(vineyardID)
	if err != nil {
		writeInternalError(w, err)
		return
	}
	for _, row := range rows {
		if row.Status == domain.RowStatusProposed {
			if err := h.repo.UpdateStatus(row.ID, domain.RowStatusConfirmed); err != nil {
				writeInternalError(w, err)
				return
			}
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *RowHandler) Delete(w http.ResponseWriter, r *http.Request) {
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
