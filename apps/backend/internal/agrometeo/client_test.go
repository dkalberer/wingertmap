package agrometeo_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"wingert/backend/internal/agrometeo"
)

func TestFetchModelGeojson(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/api/models/7/geojson", r.URL.Path)
		assert.Equal(t, "2026-05-12", r.URL.Query().Get("date"))
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
            "type":"FeatureCollection",
            "features":[
                {"type":"Feature","id":138,"properties":{
                    "station_id":138,"station_name":"SARGANS",
                    "index":226.86,"color":"red","time":"2026-05-12 00:00:00"}}
            ]
        }`))
	}))
	defer server.Close()

	c := agrometeo.NewClientWithBase(server.URL + "/api")
	date := time.Date(2026, 5, 12, 0, 0, 0, 0, time.UTC)
	feats, err := c.FetchModelGeojson(context.Background(), 7, date)
	require.NoError(t, err)
	require.Len(t, feats, 1)
	assert.Equal(t, 138, feats[0].StationID)
	assert.Equal(t, "SARGANS", feats[0].StationName)
	assert.InDelta(t, 226.86, feats[0].Index, 0.001)
	assert.Equal(t, "red", feats[0].Color)
}

func TestFetchHourlyWeather(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/api/meteo/stations/138/data") {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[
            {"date":"2026-05-15 14:00:00","series_6_sum":"0.4","series_7_avg":"20","series_1_avg":"9.9"},
            {"date":"2026-05-15 15:00:00","series_6_sum":"0.0","series_7_avg":"5","series_1_avg":"11.2"}
        ]}`))
	}))
	defer server.Close()

	c := agrometeo.NewClientWithBase(server.URL + "/api")
	from := time.Date(2026, 5, 15, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 5, 16, 0, 0, 0, 0, time.UTC)
	points, err := c.FetchHourlyWeather(context.Background(), 138, from, to)
	require.NoError(t, err)
	require.Len(t, points, 2)
	assert.InDelta(t, 0.4, points[0].PrecipMm, 0.001)
	assert.InDelta(t, 20, points[0].LeafWetPct, 0.001)
	assert.InDelta(t, 11.2, points[1].TempC, 0.001)
}

func TestModelCache(t *testing.T) {
	cache := agrometeo.NewCache()
	date := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC) // past date
	feats := []agrometeo.ModelFeature{{StationID: 138, Index: 100}}

	_, ok := cache.GetModel(7, date)
	assert.False(t, ok)

	cache.SetModel(7, date, feats)
	got, ok := cache.GetModel(7, date)
	require.True(t, ok)
	assert.Len(t, got, 1)
	assert.Equal(t, 138, got[0].StationID)
}
