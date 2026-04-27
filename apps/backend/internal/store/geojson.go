package store

import (
	"database/sql/driver"
	"encoding/json"
	"errors"

	"wingert/backend/internal/domain"
)

// geoJSON is a GORM-compatible wrapper around domain.GeoJSON for PostGIS columns.
type geoJSON struct{ domain.GeoJSON }

func (g geoJSON) Value() (driver.Value, error) {
	if len(g.RawMessage) == 0 {
		return nil, nil
	}
	return string(g.RawMessage), nil
}

func (g *geoJSON) Scan(value any) error {
	if value == nil {
		return nil
	}
	var s string
	switch v := value.(type) {
	case string:
		s = v
	case []byte:
		s = string(v)
	default:
		return errors.New("geoJSON: unsupported type")
	}
	g.RawMessage = json.RawMessage(s)
	return nil
}

func toGeoJSON(g *domain.GeoJSON) *geoJSON {
	if g == nil {
		return nil
	}
	return &geoJSON{*g}
}

func fromGeoJSON(g *geoJSON) *domain.GeoJSON {
	if g == nil || len(g.RawMessage) == 0 {
		return nil
	}
	return &g.GeoJSON
}
