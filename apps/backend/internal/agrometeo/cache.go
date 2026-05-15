package agrometeo

import (
	"sync"
	"time"

	"github.com/google/uuid"
)

const weatherTTL = 30 * time.Minute
const stationsTTL = 24 * time.Hour

type weatherEntry struct {
	data      *WeatherData
	expiresAt time.Time
}

type stationsEntry struct {
	data      []Station
	expiresAt time.Time
}

type modelKey struct {
	modelID int
	date    string // YYYY-MM-DD
}

type modelEntry struct {
	data      []ModelFeature
	expiresAt time.Time
}

type Cache struct {
	mu       sync.Mutex
	weather  map[uuid.UUID]weatherEntry
	stations *stationsEntry
	models   map[modelKey]modelEntry
}

func NewCache() *Cache {
	return &Cache{
		weather: make(map[uuid.UUID]weatherEntry),
		models:  make(map[modelKey]modelEntry),
	}
}

func (c *Cache) GetWeather(vineyardID uuid.UUID) (*WeatherData, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.weather[vineyardID]
	if !ok || time.Now().After(e.expiresAt) {
		return nil, false
	}
	return e.data, true
}

func (c *Cache) SetWeather(vineyardID uuid.UUID, d *WeatherData) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.weather[vineyardID] = weatherEntry{data: d, expiresAt: time.Now().Add(weatherTTL)}
}

func (c *Cache) GetStations() ([]Station, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.stations == nil || time.Now().After(c.stations.expiresAt) {
		return nil, false
	}
	return c.stations.data, true
}

func (c *Cache) SetStations(data []Station) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.stations = &stationsEntry{data: data, expiresAt: time.Now().Add(stationsTTL)}
}

func (c *Cache) GetModel(modelID int, date time.Time) ([]ModelFeature, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	k := modelKey{modelID, date.Format("2006-01-02")}
	e, ok := c.models[k]
	if !ok || time.Now().After(e.expiresAt) {
		return nil, false
	}
	return e.data, true
}

func (c *Cache) SetModel(modelID int, date time.Time, data []ModelFeature) {
	c.mu.Lock()
	defer c.mu.Unlock()
	k := modelKey{modelID, date.Format("2006-01-02")}
	// Past dates can be cached longer because they don't change anymore;
	// today and forecast change as new station readings arrive.
	ttl := 24 * time.Hour
	today := time.Now().UTC().Truncate(24 * time.Hour)
	if !date.Before(today) {
		ttl = 30 * time.Minute
	}
	c.models[k] = modelEntry{data: data, expiresAt: time.Now().Add(ttl)}
}
