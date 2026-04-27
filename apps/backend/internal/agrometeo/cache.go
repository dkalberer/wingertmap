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

type Cache struct {
	mu       sync.Mutex
	weather  map[uuid.UUID]weatherEntry
	stations *stationsEntry
}

func NewCache() *Cache {
	return &Cache{weather: make(map[uuid.UUID]weatherEntry)}
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
