package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"wingert/backend/internal/agrometeo"
	"wingert/backend/internal/domain"
	"wingert/backend/internal/handler"
	"wingert/backend/internal/protection"
)

type stubVineyards struct{ v *domain.Vineyard }

func (s *stubVineyards) GetByID(uuid.UUID) (*domain.Vineyard, error) { return s.v, nil }
func (s *stubVineyards) Create(string, string, *domain.GeoJSON, uuid.UUID) (*domain.Vineyard, error) {
	return nil, nil
}
func (s *stubVineyards) ListByOwner(uuid.UUID) ([]domain.Vineyard, error)        { return nil, nil }
func (s *stubVineyards) Update(uuid.UUID, string, string, *domain.GeoJSON) error { return nil }
func (s *stubVineyards) Delete(uuid.UUID) error                                  { return nil }

type stubAgro struct{}

func (stubAgro) FetchStations(context.Context) ([]agrometeo.Station, error) {
	return []agrometeo.Station{{ID: 138, Name: "SARGANS", Lat: "47.05", Lng: "9.45"}}, nil
}
func (stubAgro) FetchModelGeojson(context.Context, int, time.Time) ([]agrometeo.ModelFeature, error) {
	return []agrometeo.ModelFeature{{StationID: 138, Index: 0}}, nil
}
func (stubAgro) FetchHourlyWeather(_ context.Context, _ int, _, _ time.Time) ([]agrometeo.HourlyPoint, error) {
	return nil, nil
}

type stubSprays struct{}

func (stubSprays) Create(domain.SprayApplication) error { return nil }
func (stubSprays) FindByVineyard(uuid.UUID, time.Time) ([]domain.SprayApplication, error) {
	return nil, nil
}

type stubPSM struct{}

func (stubPSM) SearchProducts(string, int) ([]domain.PSMProduct, error)     { return nil, nil }
func (stubPSM) GetProduct(string) (*domain.PSMProduct, error)               { return nil, nil }
func (stubPSM) SearchSubstances(string, int) ([]domain.PSMSubstance, error) { return nil, nil }
func (stubPSM) GetPestsForSubstances([]uuid.UUID) ([]uuid.UUID, error)      { return nil, nil }
func (stubPSM) UpsertBatch(domain.PSMBatch) error                           { return nil }
func (stubPSM) Meta() (*domain.PSMSyncMeta, error)                          { return nil, nil }
func (stubPSM) SetMeta(domain.PSMSyncMeta) error                            { return nil }

type stubPeriods struct{}

func (stubPeriods) Create(domain.ProtectionPeriod) error { return nil }
func (stubPeriods) FindActive(uuid.UUID, domain.ProtectionPeriodKind) (*domain.ProtectionPeriod, error) {
	return nil, nil
}
func (stubPeriods) CloseLatest(uuid.UUID, domain.ProtectionPeriodKind, uuid.UUID, time.Time) error {
	return nil
}
func (stubPeriods) LatestMaehenTask(_ uuid.UUID) (*time.Time, error) { return nil, nil }

func TestDiseaseRisk(t *testing.T) {
	vy := &domain.Vineyard{
		ID: uuid.New(),
		Boundary: &domain.GeoJSON{RawMessage: []byte(`{"type":"Polygon","coordinates":[[[9.45,47.05],[9.46,47.05],[9.46,47.06],[9.45,47.06],[9.45,47.05]]]}`)},
	}
	svc := protection.NewRiskService(&stubVineyards{v: vy}, stubAgro{}, stubSprays{}, stubPSM{}, stubPeriods{}, agrometeo.NewCache())
	h := handler.NewDiseaseHandler(svc)
	r := chi.NewRouter()
	r.Get("/api/vineyards/{id}/disease-risk", h.Get)

	rr := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/api/vineyards/"+vy.ID.String()+"/disease-risk", nil)
	r.ServeHTTP(rr, req)
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())

	var body struct {
		StationName string                     `json:"stationName"`
		Diseases    []protection.DiseaseResult `json:"diseases"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &body))
	assert.Equal(t, "SARGANS", body.StationName)
	assert.GreaterOrEqual(t, len(body.Diseases), 6)
}
