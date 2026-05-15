package protection

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"wingert/backend/internal/agrometeo"
)

type SeriesPoint struct {
	Date  string  `json:"date"`
	Index float64 `json:"index"`
	Level string  `json:"level"`
}

type SeriesMeasure struct {
	Kind  string    `json:"kind"`
	At    time.Time `json:"at"`
	Label string    `json:"label,omitempty"`
}

type SeriesWeather struct {
	Date          string  `json:"date"`
	AvgTempC      float64 `json:"avgTempC"`
	MaxTempC      float64 `json:"maxTempC"`
	MinTempC      float64 `json:"minTempC"`
	PrecipMm      float64 `json:"precipMm"`
	AvgLeafWetPct float64 `json:"avgLeafWetPct"`
}

type SeriesResponse struct {
	VineyardID  uuid.UUID       `json:"vineyardId"`
	DiseaseKey  string          `json:"diseaseKey"`
	DiseaseName string          `json:"diseaseName"`
	StationID   int             `json:"stationId"`
	StationName string          `json:"stationName"`
	From        string          `json:"from"`
	To          string          `json:"to"`
	Points      []SeriesPoint   `json:"points"`
	Measures    []SeriesMeasure `json:"measures"`
	Weather     []SeriesWeather `json:"weather,omitempty"`
}

const maxSeriesRangeDays = 30

func (s *RiskService) Series(ctx context.Context, vineyardID uuid.UUID, diseaseKey string, from, to time.Time) (*SeriesResponse, error) {
	d := DiseaseByKey(diseaseKey)
	if d == nil {
		return nil, fmt.Errorf("unknown disease key %q", diseaseKey)
	}
	if to.Before(from) {
		return nil, fmt.Errorf("to must not be before from")
	}
	from = from.UTC().Truncate(24 * time.Hour)
	to = to.UTC().Truncate(24 * time.Hour)
	days := int(to.Sub(from).Hours()/24) + 1
	if days > maxSeriesRangeDays {
		return nil, fmt.Errorf("range too large (max %d days, got %d)", maxSeriesRangeDays, days)
	}

	v, err := s.vineyards.GetByID(vineyardID)
	if err != nil {
		return nil, err
	}
	if v == nil || v.Boundary == nil {
		return nil, fmt.Errorf("vineyard %s has no boundary", vineyardID)
	}
	lat, lng, err := centroid(v.Boundary)
	if err != nil {
		return nil, err
	}

	stations, err := s.agro.FetchStations(ctx)
	if err != nil {
		return nil, err
	}
	if len(stations) == 0 {
		return nil, fmt.Errorf("no agrometeo stations available")
	}
	nearest := agrometeo.NearestStation(stations, lat, lng)

	// Per-day fetches in parallel; tolerate single-day failures (skip the
	// point) so a transient Agrometeo hiccup doesn't black out the chart.
	rawPoints := make([]*SeriesPoint, days)
	var wg sync.WaitGroup

	for i := 0; i < days; i++ {
		i := i
		date := from.AddDate(0, 0, i)
		wg.Add(1)
		go func() {
			defer wg.Done()
			feats, ok := s.cache.GetModel(d.AgrometeoModelID, date)
			if !ok {
				f, err := s.agro.FetchModelGeojson(ctx, d.AgrometeoModelID, date)
				if err != nil {
					log.Printf("series: model %d on %s fetch failed: %v",
						d.AgrometeoModelID, date.Format("2006-01-02"), err)
					return
				}
				s.cache.SetModel(d.AgrometeoModelID, date, f)
				feats = f
			}
			var feature agrometeo.ModelFeature
			found := false
			for _, f := range feats {
				if f.StationID == nearest.ID {
					feature = f
					found = true
					break
				}
			}
			if !found {
				return
			}
			idx := indexFor(*d, feature)
			rawPoints[i] = &SeriesPoint{
				Date:  date.Format("2006-01-02"),
				Index: idx,
				Level: MapLevel(*d, idx),
			}
		}()
	}
	wg.Wait()

	points := make([]SeriesPoint, 0, days)
	for _, p := range rawPoints {
		if p != nil {
			points = append(points, *p)
		}
	}

	measures, err := s.collectMeasures(*d, vineyardID, from, to)
	if err != nil {
		return nil, err
	}

	hourly, err := s.agro.FetchHourlyWeather(ctx, nearest.ID, from, to)
	weatherDaily := []SeriesWeather{}
	if err == nil && len(hourly) > 0 {
		byDay := map[string][]agrometeo.HourlyPoint{}
		for _, p := range hourly {
			k := p.Time.Format("2006-01-02")
			byDay[k] = append(byDay[k], p)
		}
		for i := 0; i < days; i++ {
			date := from.AddDate(0, 0, i)
			k := date.Format("2006-01-02")
			bucket := byDay[k]
			if len(bucket) == 0 {
				continue
			}
			var tempSum, precipSum, leafSum float64
			minT, maxT := bucket[0].TempC, bucket[0].TempC
			for _, p := range bucket {
				tempSum += p.TempC
				precipSum += p.PrecipMm
				leafSum += p.LeafWetPct
				if p.TempC < minT {
					minT = p.TempC
				}
				if p.TempC > maxT {
					maxT = p.TempC
				}
			}
			n := float64(len(bucket))
			weatherDaily = append(weatherDaily, SeriesWeather{
				Date:          k,
				AvgTempC:      round1(tempSum / n),
				MinTempC:      round1(minT),
				MaxTempC:      round1(maxT),
				PrecipMm:      round1(precipSum),
				AvgLeafWetPct: round1(leafSum / n),
			})
		}
	}

	return &SeriesResponse{
		VineyardID:  vineyardID,
		DiseaseKey:  d.Key,
		DiseaseName: d.Name,
		StationID:   nearest.ID,
		StationName: nearest.Name,
		From:        from.Format("2006-01-02"),
		To:          to.Format("2006-01-02"),
		Points:      points,
		Measures:    measures,
		Weather:     weatherDaily,
	}, nil
}

func (s *RiskService) collectMeasures(d Disease, vineyardID uuid.UUID, from, to time.Time) ([]SeriesMeasure, error) {
	sprays, err := s.sprays.FindByVineyard(vineyardID, from)
	if err != nil {
		return nil, err
	}
	out := make([]SeriesMeasure, 0)
	endOfTo := to.Add(24 * time.Hour)
	for _, sp := range sprays {
		if sp.AppliedAt.After(endOfTo) {
			continue
		}
		if !targetMatches(sp.TargetPestIDs, d.PSMPestIDs) {
			continue
		}
		label := strings.Join(sp.ProductIDs, " + ")
		out = append(out, SeriesMeasure{Kind: "spray", At: sp.AppliedAt, Label: label})
	}
	return out, nil
}
