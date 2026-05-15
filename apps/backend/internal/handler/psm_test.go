package handler_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"wingert/backend/internal/domain"
	"wingert/backend/internal/handler"
)

type psmStubWithData struct {
	products []domain.PSMProduct
	product  *domain.PSMProduct
	subs     []domain.PSMSubstance
}

func (p *psmStubWithData) SearchProducts(string, int) ([]domain.PSMProduct, error) {
	return p.products, nil
}
func (p *psmStubWithData) GetProduct(string) (*domain.PSMProduct, error)               { return p.product, nil }
func (p *psmStubWithData) SearchSubstances(string, int) ([]domain.PSMSubstance, error) { return p.subs, nil }
func (psmStubWithData) GetPestsForSubstances([]uuid.UUID) ([]uuid.UUID, error)         { return nil, nil }
func (psmStubWithData) UpsertBatch(domain.PSMBatch) error                              { return nil }
func (psmStubWithData) Meta() (*domain.PSMSyncMeta, error)                             { return nil, nil }
func (psmStubWithData) SetMeta(domain.PSMSyncMeta) error                               { return nil }

func TestPSMSearchProducts(t *testing.T) {
	stub := &psmStubWithData{products: []domain.PSMProduct{{ID: "4090", Name: "Aktuan"}}}
	h := handler.NewPSMHandler(stub)
	r := chi.NewRouter()
	r.Get("/api/psm/products", h.SearchProducts)

	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, httptest.NewRequest("GET", "/api/psm/products?q=Akt", nil))
	require.Equal(t, http.StatusOK, rr.Code)
	var body []domain.PSMProduct
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &body))
	require.Len(t, body, 1)
	assert.Equal(t, "Aktuan", body[0].Name)
}

func TestPSMGetProductNotFound(t *testing.T) {
	stub := &psmStubWithData{product: nil}
	h := handler.NewPSMHandler(stub)
	r := chi.NewRouter()
	r.Get("/api/psm/products/{id}", h.GetProduct)

	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, httptest.NewRequest("GET", "/api/psm/products/9999", nil))
	assert.Equal(t, http.StatusNotFound, rr.Code)
}

func TestPSMSearchSubstances(t *testing.T) {
	sid := uuid.New()
	stub := &psmStubWithData{subs: []domain.PSMSubstance{{ID: sid, NameDE: "Folpet"}}}
	h := handler.NewPSMHandler(stub)
	r := chi.NewRouter()
	r.Get("/api/psm/substances", h.SearchSubstances)

	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, httptest.NewRequest("GET", "/api/psm/substances?q=Folp", nil))
	require.Equal(t, http.StatusOK, rr.Code)
	var body []domain.PSMSubstance
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &body))
	require.Len(t, body, 1)
	assert.Equal(t, "Folpet", body[0].NameDE)
}
