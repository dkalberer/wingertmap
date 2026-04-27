package agrometeo

import (
	"context"
	"encoding/json"
	"fmt"
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

type Client struct{ http *http.Client }

func NewClient() *Client {
	return &Client{http: &http.Client{Timeout: 10 * time.Second}}
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

func (c *Client) get(ctx context.Context, path string, dst any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+path, nil)
	if err != nil {
		return err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("agrometeo: status %d for %s", resp.StatusCode, path)
	}
	return json.NewDecoder(resp.Body).Decode(dst)
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
