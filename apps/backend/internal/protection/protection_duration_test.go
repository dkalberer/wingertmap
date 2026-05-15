package protection_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"wingert/backend/internal/agrometeo"
	"wingert/backend/internal/protection"
)

func TestEffectiveProtectionDays_DryNoGrowthPenalty(t *testing.T) {
	classes := []protection.SubstanceClass{protection.ClassPenetrant} // base 10d, low growth penalty
	d := protection.EffectiveProtectionDays(classes, nil, 75)         // post-Blüte
	assert.InDelta(t, 10.0, d, 0.5)
}

func TestEffectiveProtectionDays_GrowthPenaltyPreBloom(t *testing.T) {
	// Strobilurine (12d, high sensitivity) + BBCH 30 = 0.5x = 6d
	classes := []protection.SubstanceClass{protection.ClassStrobilurin}
	d := protection.EffectiveProtectionDays(classes, nil, 30)
	assert.InDelta(t, 6.0, d, 0.5)
}

func TestEffectiveProtectionDays_RainErodesKupfer(t *testing.T) {
	classes := []protection.SubstanceClass{protection.ClassKontaktKupfer} // 7d base, washout at 40mm
	// 20mm rain since spray → halfway-washed → ~50% protection → 3.5d effective
	hourly := []agrometeo.HourlyPoint{
		{Time: time.Now().Add(-12 * time.Hour), PrecipMm: 20.0},
	}
	d := protection.EffectiveProtectionDays(classes, hourly, 75)
	assert.InDelta(t, 3.5, d, 0.5)
}

func TestEffectiveProtectionDays_TankMixLongestWins(t *testing.T) {
	// Kupfer (7d) + Phosphonat (14d, rain-resistant)
	classes := []protection.SubstanceClass{protection.ClassKontaktKupfer, protection.ClassPhosphonat}
	d := protection.EffectiveProtectionDays(classes, nil, 75)
	assert.InDelta(t, 14.0, d, 0.5) // phosphonate wins
}

func TestEffectiveProtectionDays_HeavyRainOnSystemic(t *testing.T) {
	// Phosphonat = rain-resistant, even 50mm doesn't reduce.
	classes := []protection.SubstanceClass{protection.ClassPhosphonat}
	hourly := []agrometeo.HourlyPoint{
		{Time: time.Now().Add(-24 * time.Hour), PrecipMm: 50.0},
	}
	d := protection.EffectiveProtectionDays(classes, hourly, 75)
	assert.InDelta(t, 14.0, d, 0.5)
}

func TestEffectiveProtectionFraction(t *testing.T) {
	assert.InDelta(t, 1.0, protection.EffectiveProtectionFraction(10, 0), 0.001)
	assert.InDelta(t, 0.5, protection.EffectiveProtectionFraction(10, 5), 0.001)
	assert.InDelta(t, 0.0, protection.EffectiveProtectionFraction(10, 15), 0.001)
}
