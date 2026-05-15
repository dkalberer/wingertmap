package protection_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"wingert/backend/internal/agrometeo"
	"wingert/backend/internal/domain"
	"wingert/backend/internal/protection"
)

func ptrInt(i int) *int { return &i }

func TestMapLevel(t *testing.T) {
	mildiou := *protection.DiseaseByKey("mildiou")
	assert.Equal(t, "grün", protection.MapLevel(mildiou, 0))
	assert.Equal(t, "gelb", protection.MapLevel(mildiou, 75))
	assert.Equal(t, "rot", protection.MapLevel(mildiou, 200))
}

func TestCombine_NoMeasure(t *testing.T) {
	mildiou := *protection.DiseaseByKey("mildiou")
	raw := agrometeo.ModelFeature{Index: 226.86, Color: "red"}
	res := protection.Combine(mildiou, raw, nil, nil, time.Now(), 0, nil)
	assert.Equal(t, "rot", res.RawLevel)
	assert.Equal(t, "rot", res.EffectiveLevel)
	assert.InDelta(t, 226.86, res.EffectiveIndex, 0.001)
}

func TestCombine_SpritzungReducesRisk(t *testing.T) {
	mildiou := *protection.DiseaseByKey("mildiou")
	raw := agrometeo.ModelFeature{Index: 200, Color: "red"}
	now := time.Date(2026, 5, 13, 12, 0, 0, 0, time.UTC)
	spray := &domain.SprayApplication{
		AppliedAt:     now.Add(-6 * 24 * time.Hour), // 50% schutz bei 12 Tagen
		TargetPestIDs: mildiou.PSMPestIDs,
	}
	res := protection.Combine(mildiou, raw, spray, nil, now, 0, nil)
	assert.Equal(t, "rot", res.RawLevel)
	assert.InDelta(t, 100, res.EffectiveIndex, 1)
	assert.Equal(t, "gelb", res.EffectiveLevel)
}

func TestCombine_SpritzungExpiredHasNoEffect(t *testing.T) {
	mildiou := *protection.DiseaseByKey("mildiou")
	raw := agrometeo.ModelFeature{Index: 200, Color: "red"}
	now := time.Date(2026, 5, 13, 12, 0, 0, 0, time.UTC)
	spray := &domain.SprayApplication{
		AppliedAt:     now.Add(-20 * 24 * time.Hour),
		TargetPestIDs: mildiou.PSMPestIDs,
	}
	res := protection.Combine(mildiou, raw, spray, nil, now, 0, nil)
	assert.Equal(t, "rot", res.EffectiveLevel)
}

func TestCombine_DispenserOverridesGreen(t *testing.T) {
	tw := *protection.DiseaseByKey("traubenwickler")
	risiko := 3
	raw := agrometeo.ModelFeature{Index: 1676, Color: "purple", Risikolevel: &risiko}
	now := time.Date(2026, 5, 13, 12, 0, 0, 0, time.UTC)
	period := &domain.ProtectionPeriod{
		Kind:          domain.ProtectionPeriodDispenser,
		StartAt:       now.Add(-30 * 24 * time.Hour),
		TargetPestIDs: tw.PSMPestIDs,
	}
	res := protection.Combine(tw, raw, nil, period, now, 0, nil)
	assert.Equal(t, "rot", res.RawLevel)
	assert.Equal(t, "grün", res.EffectiveLevel)
	assert.Equal(t, "dispenser", string(res.MeasureType))
}

func TestCombine_TargetMismatchIgnoresSpray(t *testing.T) {
	mildiou := *protection.DiseaseByKey("mildiou")
	raw := agrometeo.ModelFeature{Index: 200}
	now := time.Date(2026, 5, 13, 12, 0, 0, 0, time.UTC)
	spray := &domain.SprayApplication{
		AppliedAt:     now.Add(-1 * 24 * time.Hour),
		TargetPestIDs: []uuid.UUID{uuid.New()},
	}
	res := protection.Combine(mildiou, raw, spray, nil, now, 0, nil)
	assert.Equal(t, "rot", res.EffectiveLevel)
}

func TestCombine_BoisNoir_NoMowingRecorded_IsGreen(t *testing.T) {
	bn := *protection.DiseaseByKey("bois-noir")
	// Index above red threshold
	raw := agrometeo.ModelFeature{Index: 110}
	now := time.Date(2026, 7, 1, 12, 0, 0, 0, time.UTC)
	// No mowing recorded at all
	res := protection.Combine(bn, raw, nil, nil, now, 0, nil)
	assert.Equal(t, "rot", res.RawLevel)
	assert.Equal(t, "grün", res.EffectiveLevel)
	assert.Equal(t, "mowing-pause", string(res.MeasureType))
}

func TestCombine_BoisNoir_MowedLongAgo_IsGreen(t *testing.T) {
	bn := *protection.DiseaseByKey("bois-noir")
	raw := agrometeo.ModelFeature{Index: 110}
	now := time.Date(2026, 7, 1, 12, 0, 0, 0, time.UTC)
	mowedAt := now.Add(-10 * 24 * time.Hour) // 10 days ago
	res := protection.Combine(bn, raw, nil, nil, now, 0, &mowedAt)
	assert.Equal(t, "rot", res.RawLevel)
	assert.Equal(t, "grün", res.EffectiveLevel)
	assert.Equal(t, "mowing-pause", string(res.MeasureType))
	assert.NotNil(t, res.LastMeasureAt)
}

func TestCombine_BoisNoir_MowedRecently_StaysRot(t *testing.T) {
	bn := *protection.DiseaseByKey("bois-noir")
	raw := agrometeo.ModelFeature{Index: 110}
	now := time.Date(2026, 7, 1, 12, 0, 0, 0, time.UTC)
	mowedAt := now.Add(-3 * 24 * time.Hour) // 3 days ago → within 7-day window
	res := protection.Combine(bn, raw, nil, nil, now, 0, &mowedAt)
	assert.Equal(t, "rot", res.RawLevel)
	assert.Equal(t, "rot", res.EffectiveLevel)
	assert.Contains(t, res.Recommendation, "ungünstig")
}

func TestCombine_BoisNoir_NonRedLevel_MowingOK(t *testing.T) {
	bn := *protection.DiseaseByKey("bois-noir")
	raw := agrometeo.ModelFeature{Index: 50} // below red threshold
	now := time.Date(2026, 7, 1, 12, 0, 0, 0, time.UTC)
	mowedAt := now.Add(-1 * 24 * time.Hour)
	res := protection.Combine(bn, raw, nil, nil, now, 0, &mowedAt)
	assert.NotEqual(t, "rot", res.RawLevel)
	assert.Equal(t, "Mahd weiter möglich", res.Recommendation)
}
