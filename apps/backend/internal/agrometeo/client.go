package agrometeo

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"time"
)

const baseURL = "https://api.agrometeo.ch/api"

// Sensor IDs
const (
	sensorTemp      = 1  // Temperatur 2m, avg
	sensorHumidity  = 4  // Luftfeuchtigkeit, avg
	sensorPrecip    = 6  // Niederschlag, sum
	sensorLeafWet   = 7  // Blattnässe, avg
)

type Station struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Lat  string `json:"lat_dec"`
	Lng  string `json:"long_dec"`
}

func (s Station) LatF() float64 { f, _ := strconv.ParseFloat(s.Lat, 64); return f }
func (s Station) LngF() float64 { f, _ := strconv.ParseFloat(s.Lng, 64); return f }

type WeatherData struct {
	StationID   int       `json:"stationId"`
	StationName string    `json:"stationName"`
	TempC       float64   `json:"tempC"`
	HumidityPct float64   `json:"humidityPct"`
	PrecipMm    float64   `json:"precipMm"`
	LeafWetH    float64   `json:"leafWetH"`
	FetchedAt   time.Time `json:"fetchedAt"`
}

type Client struct {
	http         *http.Client
	baseOverride string
}

func NewClient() *Client {
	return &Client{http: &http.Client{Timeout: 10 * time.Second}}
}

func NewClientWithBase(base string) *Client {
	return &Client{http: &http.Client{Timeout: 10 * time.Second}, baseOverride: base}
}

func (c *Client) base() string {
	if c.baseOverride != "" {
		return c.baseOverride
	}
	return baseURL
}

func (c *Client) FetchStations(ctx context.Context) ([]Station, error) {
	var resp struct {
		Data []Station `json:"data"`
	}
	if err := c.get(ctx, "/stations", &resp); err != nil {
		return nil, err
	}
	return resp.Data, nil
}

func (c *Client) FetchWeather(ctx context.Context, stationID int) (*WeatherData, error) {
	now := time.Now()
	from := now.Add(-25 * time.Hour).Format("2006-01-02")
	to := now.Format("2006-01-02")

	sensors := fmt.Sprintf("%d:avg,%d:avg,%d:sum,%d:avg",
		sensorTemp, sensorHumidity, sensorPrecip, sensorLeafWet)

	url := fmt.Sprintf("/meteo/data?from=%s&to=%s&scale=hour&sensors=%s&stations=%d",
		from, to, sensors, stationID)

	var resp struct {
		Data []map[string]string `json:"data"`
	}
	if err := c.get(ctx, url, &resp); err != nil {
		return nil, err
	}

	// Aggregate the last 24 hourly records
	tempKey := fmt.Sprintf("%d_%d_avg", stationID, sensorTemp)
	humKey := fmt.Sprintf("%d_%d_avg", stationID, sensorHumidity)
	precipKey := fmt.Sprintf("%d_%d_sum", stationID, sensorPrecip)
	leafKey := fmt.Sprintf("%d_%d_avg", stationID, sensorLeafWet)

	var tempSum, humSum, precipSum, leafSum float64
	var tempN, humN, leafN int

	// Take last 24 records (hourly)
	records := resp.Data
	if len(records) > 24 {
		records = records[len(records)-24:]
	}

	for _, row := range records {
		if v, err := strconv.ParseFloat(row[tempKey], 64); err == nil {
			tempSum += v; tempN++
		}
		if v, err := strconv.ParseFloat(row[humKey], 64); err == nil {
			humSum += v; humN++
		}
		if v, err := strconv.ParseFloat(row[precipKey], 64); err == nil {
			precipSum += v
		}
		if v, err := strconv.ParseFloat(row[leafKey], 64); err == nil {
			// leaf wetness is 0-1 scale per hour → hours of wetness
			leafSum += v; leafN++
		}
	}

	w := &WeatherData{
		StationID: stationID,
		FetchedAt: now,
		PrecipMm:  math.Round(precipSum*10) / 10,
	}
	if tempN > 0 {
		w.TempC = math.Round(tempSum/float64(tempN)*10) / 10
	}
	if humN > 0 {
		w.HumidityPct = math.Round(humSum/float64(humN)*10) / 10
	}
	if leafN > 0 {
		// avg leaf wetness ratio × 24h = approximate wet hours
		w.LeafWetH = math.Round(leafSum/float64(leafN)*24*10) / 10
	}

	return w, nil
}

type ModelFeature struct {
	StationID   int     `json:"stationId"`
	StationName string  `json:"stationName"`
	Index       float64 `json:"index"`
	Color       string  `json:"color"`
	Time        string  `json:"time"`
	Risikolevel *int    `json:"risikolevel,omitempty"`
	Risikostufe *int    `json:"risikostufe,omitempty"`
}

func (c *Client) FetchModelGeojson(ctx context.Context, modelID int, date time.Time) ([]ModelFeature, error) {
	url := fmt.Sprintf("/models/%d/geojson?date=%s", modelID, date.Format("2006-01-02"))
	raw, err := c.getRaw(ctx, url)
	if err != nil {
		return nil, err
	}
	// Some models (e.g. Botrytis, id 15) return a bare `[]` instead of a
	// FeatureCollection when no data is available. Detect that shape and
	// treat it as an empty result rather than a parse error.
	trimmed := bytes.TrimLeft(raw, " \t\r\n")
	if len(trimmed) > 0 && trimmed[0] == '[' {
		return nil, nil
	}
	var resp struct {
		Features []struct {
			Properties struct {
				StationID   int     `json:"station_id"`
				StationName string  `json:"station_name"`
				Index       float64 `json:"index"`
				Color       string  `json:"color"`
				Time        string  `json:"time"`
				Risikolevel *int    `json:"Risikolevel,omitempty"`
				Risikostufe *int    `json:"Risikostufe,omitempty"`
			} `json:"properties"`
		} `json:"features"`
	}
	if err := json.Unmarshal(raw, &resp); err != nil {
		return nil, fmt.Errorf("agrometeo: parse model %d response: %w", modelID, err)
	}
	out := make([]ModelFeature, len(resp.Features))
	for i, f := range resp.Features {
		out[i] = ModelFeature{
			StationID:   f.Properties.StationID,
			StationName: f.Properties.StationName,
			Index:       f.Properties.Index,
			Color:       f.Properties.Color,
			Time:        f.Properties.Time,
			Risikolevel: f.Properties.Risikolevel,
			Risikostufe: f.Properties.Risikostufe,
		}
	}
	return out, nil
}

type HourlyPoint struct {
	Time       time.Time `json:"time"`
	PrecipMm   float64   `json:"precipMm"`
	LeafWetPct float64   `json:"leafWetPct"`
	TempC      float64   `json:"tempC"`
}

// FetchHourlyWeather returns hourly observations + forecast for the station,
// in the inclusive date range [from, to]. Uses sensors 1 (temp avg), 6 (precip sum),
// 7 (leaf wet avg).
func (c *Client) FetchHourlyWeather(ctx context.Context, stationID int, from, to time.Time) ([]HourlyPoint, error) {
	url := fmt.Sprintf("/meteo/stations/%d/data?from=%s&to=%s&scale=hour&sensors=1:avg,6:sum,7:avg",
		stationID, from.Format("2006-01-02"), to.Format("2006-01-02"))
	var resp struct {
		Data []map[string]string `json:"data"`
	}
	if err := c.get(ctx, url, &resp); err != nil {
		return nil, err
	}
	out := make([]HourlyPoint, 0, len(resp.Data))
	for _, row := range resp.Data {
		t, err := time.Parse("2006-01-02 15:04:05", row["date"])
		if err != nil {
			continue
		}
		p := HourlyPoint{Time: t}
		if v, err := strconv.ParseFloat(row["series_6_sum"], 64); err == nil {
			p.PrecipMm = v
		}
		if v, err := strconv.ParseFloat(row["series_7_avg"], 64); err == nil {
			p.LeafWetPct = v
		}
		if v, err := strconv.ParseFloat(row["series_1_avg"], 64); err == nil {
			p.TempC = v
		}
		out = append(out, p)
	}
	return out, nil
}

func (c *Client) get(ctx context.Context, path string, dst any) error {
	raw, err := c.getRaw(ctx, path)
	if err != nil {
		return err
	}
	return json.Unmarshal(raw, dst)
}

func (c *Client) getRaw(ctx context.Context, path string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.base()+path, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("agrometeo: status %d for %s", resp.StatusCode, path)
	}
	return io.ReadAll(resp.Body)
}

// NearestStation returns the station closest to the given lat/lng.
func NearestStation(stations []Station, lat, lng float64) Station {
	best := stations[0]
	bestDist := haversine(lat, lng, best.LatF(), best.LngF())
	for _, s := range stations[1:] {
		if d := haversine(lat, lng, s.LatF(), s.LngF()); d < bestDist {
			bestDist = d
			best = s
		}
	}
	return best
}

func haversine(lat1, lng1, lat2, lng2 float64) float64 {
	const r = 6371
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLng/2)*math.Sin(dLng/2)
	return r * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}
