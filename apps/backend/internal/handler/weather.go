package handler

import (
	"context"
	"encoding/json"
	"log"
	"math"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"wingert/backend/internal/agrometeo"
	"wingert/backend/internal/domain"
)

type WeatherHandler struct {
	vineyards domain.VineyardRepository
	tasks     domain.TaskRepository
	client    *agrometeo.Client
	cache     *agrometeo.Cache
}

func NewWeatherHandler(
	vineyards domain.VineyardRepository,
	tasks domain.TaskRepository,
	client *agrometeo.Client,
	cache *agrometeo.Cache,
) *WeatherHandler {
	return &WeatherHandler{vineyards: vineyards, tasks: tasks, client: client, cache: cache}
}

func (h *WeatherHandler) Weather(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	if data, ok := h.cache.GetWeather(id); ok {
		writeJSON(w, http.StatusOK, data)
		return
	}

	vineyard, err := h.vineyards.GetByID(id)
	if err != nil || vineyard.Boundary == nil {
		writeError(w, http.StatusNotFound, "vineyard not found or has no boundary")
		return
	}

	lat, lng, err := centroid(vineyard.Boundary)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not compute centroid")
		return
	}

	ctx := context.Background()

	stations, ok := h.cache.GetStations()
	if !ok {
		stations, err = h.client.FetchStations(ctx)
		if err != nil {
			writeError(w, http.StatusBadGateway, "could not fetch stations")
			return
		}
		h.cache.SetStations(stations)
	}

	nearest := agrometeo.NearestStation(stations, lat, lng)

	data, err := h.client.FetchWeather(ctx, nearest.ID)
	if err != nil {
		log.Printf("agrometeo weather fetch failed: %v", err)
		writeError(w, http.StatusBadGateway, "could not fetch weather data")
		return
	}
	data.StationName = nearest.Name
	h.cache.SetWeather(id, data)

	writeJSON(w, http.StatusOK, data)
}

type protectionStatus struct {
	LastSprayDate *string `json:"lastSprayDate"`
	DaysSinceSpray *int   `json:"daysSinceSpray"`
	ProtectionPct  int    `json:"protectionPct"`
	Level          string `json:"level"` // grün | gelb | rot
}

func (h *WeatherHandler) PlantProtectionStatus(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	task, err := h.tasks.LatestSprayTask(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	status := protectionStatus{Level: "rot", ProtectionPct: 0}

	if task != nil {
		dateStr := task.CreatedAt.Format("2006-01-02")
		status.LastSprayDate = &dateStr

		days := int(math.Round(time.Since(task.CreatedAt).Hours() / 24))
		status.DaysSinceSpray = &days

		pct := int(math.Max(0, float64(100-days*100/12)))
		status.ProtectionPct = pct

		switch {
		case days <= 3:
			status.Level = "grün"
		case days <= 8:
			status.Level = "gelb"
		default:
			status.Level = "rot"
		}
	}

	writeJSON(w, http.StatusOK, status)
}

// centroid extracts the approximate center point from a GeoJSON polygon.
func centroid(g *domain.GeoJSON) (lat, lng float64, err error) {
	var geom struct {
		Coordinates [][][2]float64 `json:"coordinates"`
	}
	if err = json.Unmarshal(g.RawMessage, &geom); err != nil || len(geom.Coordinates) == 0 {
		return
	}
	ring := geom.Coordinates[0]
	for _, p := range ring {
		lng += p[0]
		lat += p[1]
	}
	n := float64(len(ring))
	return lat / n, lng / n, nil
}
