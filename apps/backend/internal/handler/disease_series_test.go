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

type seriesAgroStub struct{}

func (seriesAgroStub) FetchStations(_ context.Context) ([]agrometeo.Station, error) {
	return []agrometeo.Station{{ID: 138, Name: "SARGANS", Lat: "47.05", Lng: "9.45"}}, nil
}
func (seriesAgroStub) FetchModelGeojson(_ context.Context, _ int, _ time.Time) ([]agrometeo.ModelFeature, error) {
	return []agrometeo.ModelFeature{{StationID: 138, Index: 50}}, nil
}
func (seriesAgroStub) FetchHourlyWeather(_ context.Context, _ int, _, _ time.Time) ([]agrometeo.HourlyPoint, error) {
	return nil, nil
}

func TestDiseaseSeriesHandler_OK(t *testing.T) {
	vy := &domain.Vineyard{
		ID: uuid.New(),
		Boundary: &domain.GeoJSON{RawMessage: []byte(`{"type":"Polygon","coordinates":[[[9.45,47.05],[9.46,47.05],[9.46,47.06],[9.45,47.06],[9.45,47.05]]]}`)},
	}
	svc := protection.NewRiskService(
		&stubVineyards{v: vy},
		seriesAgroStub{},
		stubSprays{},
		stubPSM{},
		stubPeriods{},
		agrometeo.NewCache(),
	)
	h := handler.NewDiseaseHandler(svc)
	r := chi.NewRouter()
	r.Get("/api/vineyards/{id}/disease-risk/{key}/series", h.Series)

	rr := httptest.NewRecorder()
	today := time.Now().UTC().Truncate(24 * time.Hour)
	from := today.AddDate(0, 0, -3).Format("2006-01-02")
	to := today.Format("2006-01-02")
	url := "/api/vineyards/" + vy.ID.String() + "/disease-risk/mildiou/series?from=" + from + "&to=" + to
	r.ServeHTTP(rr, httptest.NewRequest("GET", url, nil))
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())

	var body protection.SeriesResponse
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &body))
	assert.Equal(t, "mildiou", body.DiseaseKey)
	assert.Len(t, body.Points, 4)
}

func TestDiseaseSeriesHandler_MissingDates(t *testing.T) {
	h := handler.NewDiseaseHandler(nil)
	r := chi.NewRouter()
	r.Get("/api/vineyards/{id}/disease-risk/{key}/series", h.Series)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, httptest.NewRequest("GET", "/api/vineyards/"+uuid.New().String()+"/disease-risk/mildiou/series", nil))
	assert.Equal(t, http.StatusBadRequest, rr.Code)
}
