package protection

import (
	"math"
	"time"
)

func round1(v float64) float64 { return math.Round(v*10) / 10 }

const (
	// DryWindowMinHours is the minimum block length to qualify as a spray window.
	DryWindowMinHours = 4
	// DryWindowLeafWetMaxPct: leaf wetness above this is considered "wet".
	DryWindowLeafWetMaxPct = 30.0
	// DryWindowPrecipMaxMm: precipitation above this in an hour disqualifies it.
	DryWindowPrecipMaxMm = 0.0
	// SprayHourMin: earliest hour-of-day (local time, inclusive) for spraying.
	// Avoids 02:00 windows even when meteorologically dry.
	SprayHourMin = 6
	// SprayHourMax: latest hour-of-day (local time, exclusive) for spraying.
	// I.e. last allowed hour-block starts at SprayHourMax-1.
	SprayHourMax = 20
	// MorningDewCutoffHour: windows starting before this hour with very low
	// forecast leaf wetness trigger a "morning dew possible" hint, because the
	// Agrometeo forecast model is conservative about predicting residual moisture.
	MorningDewCutoffHour = 9
)

// HourlyObservation is the minimal shape FindNextDryWindow needs.
// (Decoupled from agrometeo.HourlyPoint so the function stays pure and easily testable.)
type HourlyObservation struct {
	Time       time.Time
	PrecipMm   float64
	LeafWetPct float64
	TempC      float64
}

// SprayWindow describes a contiguous dry block suitable for spraying, including
// an averaged weather summary for the block.
type SprayWindow struct {
	Start         time.Time `json:"start"`
	End           time.Time `json:"end"`
	HoursDry      int       `json:"hoursDry"`
	Source        string    `json:"source"`        // e.g. "Agrometeo SARGANS"
	AvgTempC      float64   `json:"avgTempC"`      // mean air temperature in the window
	MinTempC      float64   `json:"minTempC"`      // coldest hour
	MaxTempC      float64   `json:"maxTempC"`      // warmest hour
	AvgLeafWetPct float64   `json:"avgLeafWetPct"` // mean leaf wetness (0..100)
	Hints         []string  `json:"hints,omitempty"` // human-readable warnings / suggestions
}

// hourEligible reports whether the hour qualifies as a spray hour:
// daytime [SprayHourMin, SprayHourMax) AND meteorologically dry.
func hourEligible(o HourlyObservation) bool {
	h := o.Time.Hour()
	if h < SprayHourMin || h >= SprayHourMax {
		return false
	}
	return o.PrecipMm <= DryWindowPrecipMaxMm && o.LeafWetPct < DryWindowLeafWetMaxPct
}

// FindNextDryWindow scans the hourly observations and returns the earliest
// contiguous block of at least DryWindowMinHours where every hour is dry
// (precip ≤ 0, leaf wetness < threshold) AND lies inside the daytime spray
// window [SprayHourMin, SprayHourMax). Returns nil if no such window exists.
//
// Observations must be in chronological order. The returned window's End is
// the END of the last qualifying hour (i.e. Start + N hours), not the start
// of the next hour.
func FindNextDryWindow(obs []HourlyObservation, notBefore time.Time) *SprayWindow {
	if len(obs) == 0 {
		return nil
	}
	runStart := -1
	runLen := 0
	for i, o := range obs {
		if o.Time.Before(notBefore) {
			runStart = -1
			runLen = 0
			continue
		}
		if !hourEligible(o) {
			runStart = -1
			runLen = 0
			continue
		}
		if runStart == -1 {
			runStart = i
		}
		runLen++
		if runLen >= DryWindowMinHours {
			// Extend the run while still eligible to find the full block length.
			j := i + 1
			for j < len(obs) && hourEligible(obs[j]) {
				j++
			}
			startHr := obs[runStart].Time
			endHr := obs[j-1].Time.Add(1 * time.Hour)

			// Aggregate weather over the block.
			var tempSum, leafSum float64
			minT, maxT := obs[runStart].TempC, obs[runStart].TempC
			n := 0
			for k := runStart; k < j; k++ {
				tempSum += obs[k].TempC
				leafSum += obs[k].LeafWetPct
				if obs[k].TempC < minT {
					minT = obs[k].TempC
				}
				if obs[k].TempC > maxT {
					maxT = obs[k].TempC
				}
				n++
			}
			avgT := 0.0
			avgLW := 0.0
			if n > 0 {
				avgT = tempSum / float64(n)
				avgLW = leafSum / float64(n)
			}
			w := &SprayWindow{
				Start:         startHr,
				End:           endHr,
				HoursDry:      int(endHr.Sub(startHr).Hours()),
				AvgTempC:      round1(avgT),
				MinTempC:      round1(minT),
				MaxTempC:      round1(maxT),
				AvgLeafWetPct: round1(avgLW),
			}
			// Forecast model often reports 0% leaf wetness even in morning hours
			// when real-world dew is likely. Surface a hint if the window starts
			// early and the forecast claims very low wetness.
			if startHr.Hour() < MorningDewCutoffHour && avgLW < 5 {
				w.Hints = append(w.Hints,
					"Morgentau möglich — Forecast prognostiziert 0 %, in der Praxis können Reben bis ca. 09:00 noch feucht sein.")
			}
			return w
		}
	}
	return nil
}
