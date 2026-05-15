package protection_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"wingert/backend/internal/protection"
)

func mkObs(hour int, precip, leafWet float64) protection.HourlyObservation {
	return protection.HourlyObservation{
		Time:       time.Date(2026, 5, 15, hour, 0, 0, 0, time.UTC),
		PrecipMm:   precip,
		LeafWetPct: leafWet,
	}
}

func TestFindNextDryWindow_FindsFirst4hBlock(t *testing.T) {
	obs := []protection.HourlyObservation{
		mkObs(10, 0.5, 80), // wet
		mkObs(11, 0, 60),   // still high leaf wet
		mkObs(12, 0, 20),   // dry
		mkObs(13, 0, 15),   // dry
		mkObs(14, 0, 10),   // dry
		mkObs(15, 0, 5),    // dry
		mkObs(16, 0.2, 40), // rain again
	}
	w := protection.FindNextDryWindow(obs, time.Time{})
	require.NotNil(t, w)
	assert.Equal(t, 12, w.Start.Hour())
	assert.Equal(t, 16, w.End.Hour())
	assert.Equal(t, 4, w.HoursDry)
}

func TestFindNextDryWindow_NoWindowReturnsNil(t *testing.T) {
	obs := []protection.HourlyObservation{
		mkObs(10, 0, 50),
		mkObs(11, 0, 50),
		mkObs(12, 0, 50),
	}
	w := protection.FindNextDryWindow(obs, time.Time{})
	assert.Nil(t, w)
}

func TestFindNextDryWindow_RespectsNotBefore(t *testing.T) {
	obs := []protection.HourlyObservation{
		mkObs(8, 0, 10),
		mkObs(9, 0, 10),
		mkObs(10, 0, 10),
		mkObs(11, 0, 10),
		mkObs(12, 0, 10),
		mkObs(13, 0, 10),
	}
	notBefore := time.Date(2026, 5, 15, 10, 0, 0, 0, time.UTC)
	w := protection.FindNextDryWindow(obs, notBefore)
	require.NotNil(t, w)
	assert.Equal(t, 10, w.Start.Hour())
}

func TestFindNextDryWindow_ExtendsBlockBeyondMinimum(t *testing.T) {
	obs := []protection.HourlyObservation{
		mkObs(10, 0, 5),
		mkObs(11, 0, 5),
		mkObs(12, 0, 5),
		mkObs(13, 0, 5),
		mkObs(14, 0, 5),
		mkObs(15, 0, 5),
		mkObs(16, 1.0, 60), // rain ends it
	}
	w := protection.FindNextDryWindow(obs, time.Time{})
	require.NotNil(t, w)
	assert.Equal(t, 6, w.HoursDry)
}

func TestFindNextDryWindow_RejectsNightWindow(t *testing.T) {
	// Dry from 02:00–07:00 but only 06:00 + 07:00 are inside daytime → only 2 dry hours.
	obs := []protection.HourlyObservation{
		mkObs(2, 0, 5),
		mkObs(3, 0, 5),
		mkObs(4, 0, 5),
		mkObs(5, 0, 5),
		mkObs(6, 0, 5),
		mkObs(7, 0, 5),
		mkObs(8, 1.0, 60), // rain ends it
	}
	w := protection.FindNextDryWindow(obs, time.Time{})
	assert.Nil(t, w, "should reject night hours even if meteorologically dry")
}

func TestFindNextDryWindow_StartsAtSprayHourMin(t *testing.T) {
	// Dry continuously from 04:00 onwards; window must start at 06:00 not 04:00.
	obs := []protection.HourlyObservation{
		mkObs(4, 0, 5),
		mkObs(5, 0, 5),
		mkObs(6, 0, 5),
		mkObs(7, 0, 5),
		mkObs(8, 0, 5),
		mkObs(9, 0, 5),
	}
	w := protection.FindNextDryWindow(obs, time.Time{})
	require.NotNil(t, w)
	assert.Equal(t, 6, w.Start.Hour(), "window must start at SprayHourMin")
	assert.Equal(t, 4, w.HoursDry)
}

func TestFindNextDryWindow_StopsAtSprayHourMax(t *testing.T) {
	// Dry from 17:00 onwards into the night; block should cap at 20:00.
	obs := []protection.HourlyObservation{
		mkObs(17, 0, 5),
		mkObs(18, 0, 5),
		mkObs(19, 0, 5),
		mkObs(20, 0, 5),
		mkObs(21, 0, 5),
		mkObs(22, 0, 5),
	}
	w := protection.FindNextDryWindow(obs, time.Time{})
	// Only 17, 18, 19 are within daytime (20 excluded) → 3h, not enough.
	assert.Nil(t, w, "block must not extend past SprayHourMax")
}

func TestFindNextDryWindow_MorningDewHint(t *testing.T) {
	// Window starts at 06:00 with 0% forecast leaf wetness — should trigger hint.
	obs := []protection.HourlyObservation{
		mkObs(6, 0, 0),
		mkObs(7, 0, 0),
		mkObs(8, 0, 0),
		mkObs(9, 0, 0),
	}
	w := protection.FindNextDryWindow(obs, time.Time{})
	require.NotNil(t, w)
	require.Len(t, w.Hints, 1)
	assert.Contains(t, w.Hints[0], "Morgentau")
}

func TestFindNextDryWindow_NoDewHintAfter9(t *testing.T) {
	// Window starts at 10:00 with 0% leaf wet → no morning-dew hint.
	obs := []protection.HourlyObservation{
		mkObs(10, 0, 0),
		mkObs(11, 0, 0),
		mkObs(12, 0, 0),
		mkObs(13, 0, 0),
	}
	w := protection.FindNextDryWindow(obs, time.Time{})
	require.NotNil(t, w)
	assert.Empty(t, w.Hints)
}
