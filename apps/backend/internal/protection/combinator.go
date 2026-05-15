package protection

import (
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
	"wingert/backend/internal/agrometeo"
	"wingert/backend/internal/domain"
)

type DiseaseResult struct {
	Key            string      `json:"key"`
	Name           string      `json:"name"`
	ModelID        int         `json:"modelId"`
	RawIndex       float64     `json:"rawIndex"`
	RawLevel       string      `json:"rawLevel"`
	EffectiveIndex float64     `json:"effectiveIndex"`
	EffectiveLevel string      `json:"effectiveLevel"`
	MeasureType    MeasureType `json:"measureType,omitempty"`
	LastMeasureAt  *time.Time  `json:"lastMeasureAt,omitempty"`
	Recommendation string      `json:"recommendation,omitempty"`
	IndexUnit      string      `json:"indexUnit,omitempty"`
	IndexHelp      string      `json:"indexHelp,omitempty"`
	PrevIndex      *float64    `json:"prevIndex,omitempty"`   // yesterday's index for trend calculation
	IndexDelta     *float64    `json:"indexDelta,omitempty"`  // today - yesterday
	IndexLabel     string      `json:"indexLabel,omitempty"`  // optional human-readable label (e.g. "1. Flug aktiv")
	RecentMaxIndex          *float64   `json:"recentMaxIndex,omitempty"`          // highest index in lookback window (only if differs from today)
	RecentMaxAt             *time.Time `json:"recentMaxAt,omitempty"`             // date when the peak occurred
	IncubationDays          int        `json:"incubationDays,omitempty"`          // disease-specific incubation length for context
	ProtectionDaysTotal     float64    `json:"protectionDaysTotal,omitempty"`
	ProtectionDaysRemaining float64    `json:"protectionDaysRemaining,omitempty"`
}

// indexFor returns the index value used for level mapping based on disease config.
func indexFor(d Disease, f agrometeo.ModelFeature) float64 {
	switch d.Thresholds.UseField {
	case "risikolevel":
		if f.Risikolevel != nil {
			return float64(*f.Risikolevel)
		}
	case "risikostufe":
		if f.Risikostufe != nil {
			return float64(*f.Risikostufe)
		}
	}
	return f.Index
}

// MapLevel maps a numeric index to grün/gelb/rot based on the disease's thresholds.
// Boundaries: [0, YellowAt) = grün, [YellowAt, RedAt] = gelb, (RedAt, ∞) = rot.
// For discrete integer scales (e.g. traubenwickler risikolevel), set RedAt to
// a half-integer (e.g. 2.5) so that integer level 3 maps unambiguously to rot.
func MapLevel(d Disease, index float64) string {
	if index < d.Thresholds.YellowAt {
		return "grün"
	}
	if index <= d.Thresholds.RedAt {
		return "gelb"
	}
	return "rot"
}

// Combine takes the raw Agrometeo feature and any active measure for the
// disease, and returns the effective DiseaseResult. Pure function — no I/O.
// sprayProtectionDays: effective protection duration computed from substance
// classes + rain erosion. Pass 0 to fall back to DefaultSprayProtectionDays.
// lastMowingAt: timestamp of the most recent "maehen" task for the vineyard
// (nil if none); used only for MeasureMowingPause diseases.
func Combine(d Disease, raw agrometeo.ModelFeature,
	spray *domain.SprayApplication, period *domain.ProtectionPeriod,
	now time.Time,
	sprayProtectionDays float64,
	lastMowingAt *time.Time,
) DiseaseResult {

	rawIdx := indexFor(d, raw)
	rawLevel := MapLevel(d, rawIdx)
	res := DiseaseResult{
		Key:            d.Key,
		Name:           d.Name,
		ModelID:        d.AgrometeoModelID,
		RawIndex:       rawIdx,
		RawLevel:       rawLevel,
		EffectiveIndex: rawIdx,
		EffectiveLevel: rawLevel,
		IndexUnit:      d.IndexUnit,
		IndexHelp:      d.IndexHelp,
		IndexLabel:     labelForDisease(d, rawIdx),
	}

	if d.Measure == MeasureInfoOnly {
		return res
	}

	switch d.Measure {
	case MeasureSpray:
		if spray != nil && targetMatches(spray.TargetPestIDs, d.PSMPestIDs) {
			days := now.Sub(spray.AppliedAt).Hours() / 24
			protectDays := sprayProtectionDays
			if protectDays <= 0 {
				protectDays = float64(DefaultSprayProtectionDays)
			}
			protection := EffectiveProtectionFraction(protectDays, days)
			effective := rawIdx * (1 - protection)
			res.EffectiveIndex = effective
			res.EffectiveLevel = MapLevel(d, effective)
			res.MeasureType = MeasureSpray
			t := spray.AppliedAt
			res.LastMeasureAt = &t
			res.ProtectionDaysTotal = protectDays
			res.ProtectionDaysRemaining = math.Max(0, protectDays-days)
			res.Recommendation = recommendSpray(d, res.EffectiveLevel, int(days))
			return res
		}
		res.Recommendation = recommendSpray(d, rawLevel, -1)

	case MeasureDispenser:
		if period != nil && period.Kind == domain.ProtectionPeriodDispenser &&
			targetMatches(period.TargetPestIDs, d.PSMPestIDs) {
			res.EffectiveLevel = "grün"
			res.EffectiveIndex = 0
			res.MeasureType = MeasureDispenser
			t := period.StartAt
			res.LastMeasureAt = &t
			res.Recommendation = fmt.Sprintf("Dispenser aktiv seit %s", t.Format("02.01.2006"))
			return res
		}
		res.Recommendation = recommendDispenser(d, rawLevel)

	case MeasureMowingPause:
		// Bois Noir: Brennnessel-Mahd must be paused during peak vector activity.
		// We infer "pause active" from the gap since the last mowing: if it's
		// been more than 7 days, the user is implicitly pausing the mowing.
		const mowingPauseGapDays = 7
		if rawLevel == "rot" {
			if lastMowingAt == nil {
				// No mowing recorded yet — assume safe (pause implicit)
				res.EffectiveLevel = "grün"
				res.MeasureType = MeasureMowingPause
				res.Recommendation = "Brennnessel-Mahd weiter vermeiden"
				return res
			}
			daysSinceMowing := now.Sub(*lastMowingAt).Hours() / 24
			if daysSinceMowing >= mowingPauseGapDays {
				res.EffectiveLevel = "grün"
				res.MeasureType = MeasureMowingPause
				t := *lastMowingAt
				res.LastMeasureAt = &t
				res.Recommendation = fmt.Sprintf("Mahd ausgesetzt (letztes Mähen vor %.0f Tagen)", daysSinceMowing)
			} else {
				// Recently mowed during high risk → warn
				res.Recommendation = fmt.Sprintf("Mähen vor %.0f Tagen — bei rotem Risiko ungünstig (Vektor verbreitet)", daysSinceMowing)
			}
			return res
		}
		// Non-red levels: mowing OK
		res.Recommendation = "Mahd weiter möglich"
	}

	return res
}

// targetMatches returns true if any pest ID in taskPests is also in diseasePests.
// taskPests==nil/empty means the spray (or period) does not specify targets —
// callers are expected to resolve substance → pest IDs upstream before passing.
func targetMatches(taskPests, diseasePests []uuid.UUID) bool {
	if len(taskPests) == 0 {
		return false
	}
	for _, p := range taskPests {
		for _, d := range diseasePests {
			if p == d {
				return true
			}
		}
	}
	return false
}

func recommendSpray(d Disease, level string, daysSince int) string {
	switch level {
	case "rot":
		if daysSince < 0 {
			return "Spritzung dringend empfohlen"
		}
		return "Schutz schwach — neue Spritzung empfohlen"
	case "gelb":
		return "Risiko erhöht — Spritzung im Blick behalten"
	default:
		return "Kein akutes Risiko"
	}
}

func recommendDispenser(d Disease, level string) string {
	if level == "rot" {
		return "Flugphase aktiv — Dispenser aufhängen empfohlen"
	}
	return "Aktuell kein Eingreifen nötig"
}

// labelForDisease returns an optional human-readable label for a disease's
// current index. Currently only Traubenwickler uses this (flight phases);
// other diseases return empty.
func labelForDisease(d Disease, index float64) string {
	if d.Key == "traubenwickler" {
		// Risikolevel scale 1..5 from Agrometeo legend
		switch int(index) {
		case 1:
			return "kein Risiko"
		case 2:
			return "Vorwarnung — Fallen aufstellen"
		case 3:
			return "1. Flug möglich"
		case 4:
			return "1. Flug aktiv"
		case 5:
			return "2. Flug aktiv"
		}
	}
	if d.Key == "acariose" && index >= 550 {
		return "Modell-Saison beendet"
	}
	return ""
}
