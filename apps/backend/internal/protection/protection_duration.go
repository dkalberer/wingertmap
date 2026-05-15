package protection

import (
	"time"

	"wingert/backend/internal/agrometeo"
)

// EffectiveProtectionDays returns how many days of protection a spray provides
// under the actual conditions (growth phase + rain since application).
// hourly: weather observations from spray.AppliedAt to now. Pass nil/empty if not available.
// bbchStage: phenology BBCH value (0..89). Pass 0 if unknown — assumes neutral.
func EffectiveProtectionDays(classes []SubstanceClass, hourly []agrometeo.HourlyPoint, bbchStage int) float64 {
	if len(classes) == 0 {
		return float64(DefaultSprayProtectionDays)
	}
	// Sum precipitation since spray.
	var precipSinceSpray float64
	for _, p := range hourly {
		precipSinceSpray += p.PrecipMm
	}

	growth := growthFactor(bbchStage)

	// Take the most generous (longest-protecting) class — covers tank mixes
	// where one component provides systemic protection beyond the contact partners.
	best := 0.0
	for _, c := range classes {
		base := c.BaseProtectDays
		// Growth penalty
		switch c.GrowthSensitivity {
		case "high":
			base *= growth.high
		case "medium":
			base *= growth.medium
		default:
			base *= growth.low
		}
		// Rain washout
		base *= rainFactor(precipSinceSpray, c)
		if base > best {
			best = base
		}
	}
	return best
}

type growthFactors struct{ high, medium, low float64 }

// growthFactor returns multipliers for high/medium/low growth-sensitivity classes
// based on BBCH phenology. Lower BBCH = stronger shoot growth = faster dilution.
func growthFactor(bbch int) growthFactors {
	switch {
	case bbch == 0:
		return growthFactors{high: 0.8, medium: 0.9, low: 1.0} // unknown -> mild penalty
	case bbch < 50:
		return growthFactors{high: 0.5, medium: 0.7, low: 0.9}
	case bbch < 70:
		return growthFactors{high: 0.7, medium: 0.85, low: 0.95}
	default:
		return growthFactors{high: 1.0, medium: 1.0, low: 1.0}
	}
}

// rainFactor returns a 0..1 multiplier for the class's protection given the
// total precipitation since the spray.
func rainFactor(precipMm float64, c SubstanceClass) float64 {
	if c.RainWashoutMm == 0 {
		return 1.0 // rain-resistant class
	}
	washout := precipMm / c.RainWashoutMm
	if washout >= 1.0 {
		return c.RainResistantPct
	}
	residual := 1.0 - washout*(1.0-c.RainResistantPct)
	if residual < c.RainResistantPct {
		residual = c.RainResistantPct
	}
	return residual
}

// EffectiveProtectionFraction returns the fraction of protection remaining today.
// days_since: full days between spray.AppliedAt and `now`.
func EffectiveProtectionFraction(effectiveDays, daysSince float64) float64 {
	if effectiveDays <= 0 {
		return 0
	}
	p := 1.0 - daysSince/effectiveDays
	if p < 0 {
		p = 0
	}
	if p > 1 {
		p = 1
	}
	return p
}

// HourlyWeatherSince filters hourly points to those after `since`.
func HourlyWeatherSince(hourly []agrometeo.HourlyPoint, since time.Time) []agrometeo.HourlyPoint {
	out := make([]agrometeo.HourlyPoint, 0, len(hourly))
	for _, p := range hourly {
		if !p.Time.Before(since) {
			out = append(out, p)
		}
	}
	return out
}
