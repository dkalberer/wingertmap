package protection

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"sync"
	"time"

	"github.com/google/uuid"
	"wingert/backend/internal/agrometeo"
	"wingert/backend/internal/domain"
)

// AgrometeoAPI is the minimal interface RiskService needs from agrometeo.Client.
// Defined locally so tests can substitute a fake without importing the real client.
type AgrometeoAPI interface {
	FetchStations(ctx context.Context) ([]agrometeo.Station, error)
	FetchModelGeojson(ctx context.Context, modelID int, date time.Time) ([]agrometeo.ModelFeature, error)
	FetchHourlyWeather(ctx context.Context, stationID int, from, to time.Time) ([]agrometeo.HourlyPoint, error)
}

const psmStaleThreshold = 60 * 24 * time.Hour

type RiskService struct {
	vineyards domain.VineyardRepository
	agro      AgrometeoAPI
	sprays    domain.SprayRepository
	psm       domain.PSMRepository
	periods   domain.ProtectionPeriodRepository
	cache     *agrometeo.Cache
}

func NewRiskService(v domain.VineyardRepository, a AgrometeoAPI,
	s domain.SprayRepository, p domain.PSMRepository,
	pp domain.ProtectionPeriodRepository, c *agrometeo.Cache) *RiskService {
	return &RiskService{vineyards: v, agro: a, sprays: s, psm: p, periods: pp, cache: c}
}

type RiskResponse struct {
	VineyardID   uuid.UUID       `json:"vineyardId"`
	StationID    int             `json:"stationId"`
	StationName  string          `json:"stationName"`
	FetchedAt    time.Time       `json:"fetchedAt"`
	Phenology    *PhenologyInfo  `json:"phenology,omitempty"`
	Diseases     []DiseaseResult `json:"diseases"`
	PSMSyncStale bool            `json:"psmSyncStale,omitempty"`
	PSMSyncAt    *time.Time      `json:"psmSyncAt,omitempty"`
	SprayWindow  *SprayWindow    `json:"sprayWindow,omitempty"`
}

type PhenologyInfo struct {
	RawIndex float64 `json:"rawIndex"`
	Label    string  `json:"label"`
}

func (s *RiskService) Compute(ctx context.Context, vineyardID uuid.UUID) (*RiskResponse, error) {
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

	today := time.Now().UTC().Truncate(24 * time.Hour)
	sprays, err := s.sprays.FindByVineyard(vineyardID, today.AddDate(0, 0, -DefaultSprayProtectionDays*2))
	if err != nil {
		return nil, err
	}

	out := &RiskResponse{
		VineyardID:  vineyardID,
		StationID:   nearest.ID,
		StationName: nearest.Name,
		FetchedAt:   time.Now(),
		Diseases:    []DiseaseResult{},
	}

	// Fetch all model geojsons in parallel. Per-model errors are logged but
	// tolerated — we still return a partial response so a single Agrometeo
	// hiccup doesn't black out the whole panel.
	type modelResult struct {
		idx           int
		feature       agrometeo.ModelFeature
		hasData       bool
		prevFeature   agrometeo.ModelFeature
		hasPrevData   bool
		recentMaxIdx  float64
		recentMaxDate time.Time
		hasRecentMax  bool
	}
	results := make([]modelResult, len(Diseases))
	var wg sync.WaitGroup
	for i, d := range Diseases {
		i, d := i, d
		wg.Add(1)
		go func() {
			defer wg.Done()
			feats, ok := s.cache.GetModel(d.AgrometeoModelID, today)
			if !ok {
				f, err := s.agro.FetchModelGeojson(ctx, d.AgrometeoModelID, today)
				if err != nil {
					log.Printf("disease-risk: model %d fetch failed: %v", d.AgrometeoModelID, err)
					return
				}
				s.cache.SetModel(d.AgrometeoModelID, today, f)
				feats = f
			}
			res := modelResult{idx: i}
			for _, f := range feats {
				if f.StationID == nearest.ID {
					res.feature = f
					res.hasData = true
					break
				}
			}
			// Yesterday — only useful for non-info-only diseases
			if d.Measure != MeasureInfoOnly {
				yesterday := today.AddDate(0, 0, -1)
				pfeats, pok := s.cache.GetModel(d.AgrometeoModelID, yesterday)
				if !pok {
					if pf, perr := s.agro.FetchModelGeojson(ctx, d.AgrometeoModelID, yesterday); perr == nil {
						s.cache.SetModel(d.AgrometeoModelID, yesterday, pf)
						pfeats = pf
					}
				}
				for _, f := range pfeats {
					if f.StationID == nearest.ID {
						res.prevFeature = f
						res.hasPrevData = true
						break
					}
				}
			}
			// Incubation lookback — scan past IncubationDays to find the worst
			// recent infection event that may still be biologically active.
			if d.IncubationDays > 0 {
				for back := 1; back <= d.IncubationDays; back++ {
					date := today.AddDate(0, 0, -back)
					feats, ok := s.cache.GetModel(d.AgrometeoModelID, date)
					if !ok {
						if f, err := s.agro.FetchModelGeojson(ctx, d.AgrometeoModelID, date); err == nil {
							s.cache.SetModel(d.AgrometeoModelID, date, f)
							feats = f
						}
					}
					for _, f := range feats {
						if f.StationID == nearest.ID {
							idx := indexFor(d, f)
							if !res.hasRecentMax || idx > res.recentMaxIdx {
								res.recentMaxIdx = idx
								res.recentMaxDate = date
								res.hasRecentMax = true
							}
							break
						}
					}
				}
			}
			results[i] = res
		}()
	}
	wg.Wait()

	// Fetch hourly weather once for the extended range:
	// today-21 (covers spray duration calculation) to today+3 (forecast for spray window finder).
	// Best-effort — failure must not break the entire response.
	hourlyFrom := today.AddDate(0, 0, -21)
	hourlyTo := today.AddDate(0, 0, 3)
	hourly, hourlyErr := s.agro.FetchHourlyWeather(ctx, nearest.ID, hourlyFrom, hourlyTo)
	if hourlyErr != nil {
		log.Printf("hourly weather fetch failed: %v", hourlyErr)
	}

	for i, d := range Diseases {
		r := results[i]
		feature := r.feature

		if d.Key == "phenologie" {
			if r.hasData {
				out.Phenology = &PhenologyInfo{
					RawIndex: feature.Index,
					Label:    bbchLabel(int(feature.Index)),
				}
			}
			continue
		}

		// Skip diseases for which the model fetch failed — we have no useful
		// data to combine. Better to omit than to show false "grün".
		if !r.hasData {
			continue
		}

		relevantSpray := pickRelevantSpray(sprays, d.PSMPestIDs, s.psm)
		var period *domain.ProtectionPeriod
		var lastMowingAt *time.Time
		switch d.Measure {
		case MeasureDispenser:
			period, _ = s.periods.FindActive(vineyardID, domain.ProtectionPeriodDispenser)
		case MeasureMowingPause:
			lastMowingAt, _ = s.periods.LatestMaehenTask(vineyardID)
		}

		sprayProtectDays := 0.0
		if relevantSpray != nil {
			classes := ClassesForSpray(relevantSpray.SubstanceIDs)
			bbch := 0
			if out.Phenology != nil {
				bbch = int(out.Phenology.RawIndex)
			}
			since := HourlyWeatherSince(hourly, relevantSpray.AppliedAt)
			sprayProtectDays = EffectiveProtectionDays(classes, since, bbch)
		}
		res := Combine(d, feature, relevantSpray, period, time.Now(), sprayProtectDays, lastMowingAt)
		if r.hasPrevData {
			prevIdx := indexFor(d, r.prevFeature)
			delta := res.RawIndex - prevIdx
			res.PrevIndex = &prevIdx
			res.IndexDelta = &delta
		}
		if r.hasRecentMax && d.IncubationDays > 0 {
			res.IncubationDays = d.IncubationDays
			// Only escalate when the past peak was worse than today's index.
			if r.recentMaxIdx > res.RawIndex {
				maxIdx := r.recentMaxIdx
				maxDate := r.recentMaxDate
				res.RecentMaxIndex = &maxIdx
				res.RecentMaxAt = &maxDate
				// If the recent peak puts us at a worse level, escalate.
				recentLevel := MapLevel(d, maxIdx)
				if rankLevel(recentLevel) < rankLevel(res.RawLevel) {
					res.RawLevel = recentLevel
					// Re-apply spray protection on the elevated index.
					if relevantSpray != nil && targetMatches(relevantSpray.TargetPestIDs, d.PSMPestIDs) {
						days := time.Since(relevantSpray.AppliedAt).Hours() / 24
						protection := EffectiveProtectionFraction(sprayProtectDays, days)
						effective := maxIdx * (1 - protection)
						res.EffectiveIndex = effective
						res.EffectiveLevel = MapLevel(d, effective)
					} else {
						res.EffectiveIndex = maxIdx
						res.EffectiveLevel = recentLevel
					}
					// Augment recommendation with incubation context.
					daysAgo := int(time.Since(r.recentMaxDate).Hours() / 24)
					res.Recommendation = fmt.Sprintf(
						"Infektions-Peak vor %d Tagen (Index %.0f) — Inkubation bis ca. %s. %s",
						daysAgo, maxIdx,
						r.recentMaxDate.AddDate(0, 0, d.IncubationDays).Format("02.01."),
						res.Recommendation,
					)
				}
			}
		}
		out.Diseases = append(out.Diseases, res)
	}

	sortBySeverity(out.Diseases)

	// Compute spray window only if at least one spray-relevant disease is
	// currently above grün (today) OR is forecast to cross the yellow
	// threshold in the next 3 days. No need to fetch hourly weather (and
	// surface a banner) when there's nothing to spray against.
	needsSpray := sprayNeeded(out.Diseases)
	if !needsSpray {
		needsSpray = sprayForecastNeeded(ctx, s, nearest.ID, today)
	}

	if needsSpray && hourlyErr == nil && len(hourly) > 0 {
		converted := make([]HourlyObservation, len(hourly))
		for i, p := range hourly {
			converted[i] = HourlyObservation{
				Time:       p.Time,
				PrecipMm:   p.PrecipMm,
				LeafWetPct: p.LeafWetPct,
				TempC:      p.TempC,
			}
		}
		if w := FindNextDryWindow(converted, time.Now()); w != nil {
			w.Source = "Agrometeo " + nearest.Name
			out.SprayWindow = w
		}
	}

	if meta, err := s.psm.Meta(); err == nil && meta != nil {
		syncAt := meta.LastSyncAt
		out.PSMSyncAt = &syncAt
		if time.Since(meta.LastSyncAt) > psmStaleThreshold {
			out.PSMSyncStale = true
		}
	}
	return out, nil
}

// pickRelevantSpray finds the most recent spray whose targets include one of
// diseasePests. If the spray has no explicit TargetPestIDs, the substance list
// is resolved via the PSM repository.
func pickRelevantSpray(sprays []domain.SprayApplication, diseasePests []uuid.UUID, psm domain.PSMRepository) *domain.SprayApplication {
	for i := range sprays {
		targets := sprays[i].TargetPestIDs
		if len(targets) == 0 {
			t, err := psm.GetPestsForSubstances(sprays[i].SubstanceIDs)
			if err == nil {
				targets = t
			}
		}
		for _, t := range targets {
			for _, d := range diseasePests {
				if t == d {
					return &sprays[i]
				}
			}
		}
	}
	return nil
}

// rankLevel returns a severity rank: rot=0 (worst), gelb=1, grün=2, unknown=3.
// Lower rank = worse. Used to compare levels without string equality chains.
func rankLevel(level string) int {
	switch level {
	case "rot":
		return 0
	case "gelb":
		return 1
	case "grün":
		return 2
	default:
		return 3
	}
}

func sortBySeverity(rs []DiseaseResult) {
	rank := map[string]int{"rot": 0, "gelb": 1, "grün": 2, "": 3}
	for i := 1; i < len(rs); i++ {
		for j := i; j > 0; j-- {
			if rank[rs[j].EffectiveLevel] < rank[rs[j-1].EffectiveLevel] {
				rs[j], rs[j-1] = rs[j-1], rs[j]
			} else {
				break
			}
		}
	}
}

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

func bbchLabel(idx int) string {
	switch {
	case idx == 0:
		return "Keine Daten"
	case idx < 20:
		return "BBCH 09-19 Blattentwicklung"
	case idx < 50:
		return "BBCH 20-49 Triebentwicklung"
	case idx < 60:
		return "BBCH 50-59 Blütenbildung"
	case idx < 70:
		return "BBCH 60-69 Blüte"
	case idx < 80:
		return "BBCH 70-79 Fruchtentwicklung"
	default:
		return fmt.Sprintf("BBCH %d Reife", int(math.Min(89, float64(idx))))
	}
}

// sprayNeeded reports whether at least one spray-relevant disease in the
// computed results has an effective level above grün — i.e. there's a current
// reason to spray.
func sprayNeeded(results []DiseaseResult) bool {
	for _, r := range results {
		d := DiseaseByKey(r.Key)
		if d == nil || d.Measure != MeasureSpray {
			continue
		}
		if r.EffectiveLevel == "gelb" || r.EffectiveLevel == "rot" {
			return true
		}
	}
	return false
}

// sprayForecastNeeded reports whether the model forecast for the next 3 days
// shows any spray-relevant disease crossing the yellow threshold. Best-effort
// — failures are ignored (no spray window suggested). Uses the cache so this
// doesn't double the request count when called later in Compute.
func sprayForecastNeeded(ctx context.Context, s *RiskService, stationID int, today time.Time) bool {
	for _, d := range Diseases {
		if d.Measure != MeasureSpray {
			continue
		}
		for offset := 1; offset <= 3; offset++ {
			date := today.AddDate(0, 0, offset)
			feats, ok := s.cache.GetModel(d.AgrometeoModelID, date)
			if !ok {
				f, err := s.agro.FetchModelGeojson(ctx, d.AgrometeoModelID, date)
				if err != nil {
					continue
				}
				s.cache.SetModel(d.AgrometeoModelID, date, f)
				feats = f
			}
			for _, f := range feats {
				if f.StationID != stationID {
					continue
				}
				idx := indexFor(d, f)
				if MapLevel(d, idx) != "grün" {
					return true
				}
				break
			}
		}
	}
	return false
}
