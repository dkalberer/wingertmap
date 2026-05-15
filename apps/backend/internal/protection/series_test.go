package protection_test

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"wingert/backend/internal/agrometeo"
	"wingert/backend/internal/domain"
	"wingert/backend/internal/protection"
)

type countingAgro struct {
	fakeAgrometeo
	calls atomic.Int32
}

func (c *countingAgro) FetchModelGeojson(ctx context.Context, modelID int, date time.Time) ([]agrometeo.ModelFeature, error) {
	c.calls.Add(1)
	return c.fakeAgrometeo.FetchModelGeojson(ctx, modelID, date)
}

func TestSeries_FetchesEachDayInRange(t *testing.T) {
	vy := &domain.Vineyard{
		ID: uuid.New(),
		Boundary: &domain.GeoJSON{RawMessage: []byte(`{"type":"Polygon","coordinates":[[[9.45,47.05],[9.46,47.05],[9.46,47.06],[9.45,47.06],[9.45,47.05]]]}`)},
	}
	vys := &fakeVineyards{v: vy}
	feats := []agrometeo.ModelFeature{{StationID: 138, Index: 100, Color: "#ffaaaa", Time: "x"}}
	base := &fakeAgrometeo{
		stations: []agrometeo.Station{{ID: 138, Name: "SARGANS", Lat: "47.054", Lng: "9.447"}},
		features: map[int][]agrometeo.ModelFeature{7: feats},
	}
	agro := &countingAgro{fakeAgrometeo: *base}

	svc := protection.NewRiskService(vys, agro, &fakeSpray{}, &fakePSM{}, &fakePeriods{}, agrometeo.NewCache())

	from := time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 5, 13, 0, 0, 0, 0, time.UTC)
	res, err := svc.Series(context.Background(), vy.ID, "mildiou", from, to)
	require.NoError(t, err)
	require.Len(t, res.Points, 4)
	assert.Equal(t, "mildiou", res.DiseaseKey)
	assert.Equal(t, "Falscher Mehltau", res.DiseaseName)
	assert.Equal(t, "SARGANS", res.StationName)
	assert.EqualValues(t, 4, agro.calls.Load())
	for _, p := range res.Points {
		assert.InDelta(t, 100.0, p.Index, 0.001)
		assert.Equal(t, "gelb", p.Level)
	}
}

func TestSeries_UnknownDiseaseKey(t *testing.T) {
	vy := &domain.Vineyard{
		ID: uuid.New(),
		Boundary: &domain.GeoJSON{RawMessage: []byte(`{"type":"Polygon","coordinates":[[[9.45,47.05],[9.46,47.05],[9.46,47.06],[9.45,47.06],[9.45,47.05]]]}`)},
	}
	svc := protection.NewRiskService(&fakeVineyards{v: vy}, &fakeAgrometeo{}, &fakeSpray{}, &fakePSM{}, &fakePeriods{}, agrometeo.NewCache())
	from := time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 5, 13, 0, 0, 0, 0, time.UTC)
	_, err := svc.Series(context.Background(), vy.ID, "no-such-thing", from, to)
	assert.Error(t, err)
}

func TestSeries_FromAfterToIsError(t *testing.T) {
	vy := &domain.Vineyard{
		ID: uuid.New(),
		Boundary: &domain.GeoJSON{RawMessage: []byte(`{"type":"Polygon","coordinates":[[[9.45,47.05],[9.46,47.05],[9.46,47.06],[9.45,47.06],[9.45,47.05]]]}`)},
	}
	svc := protection.NewRiskService(&fakeVineyards{v: vy}, &fakeAgrometeo{stations: []agrometeo.Station{{ID: 138, Name: "S", Lat: "47", Lng: "9"}}}, &fakeSpray{}, &fakePSM{}, &fakePeriods{}, agrometeo.NewCache())
	from := time.Date(2026, 5, 13, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC)
	_, err := svc.Series(context.Background(), vy.ID, "mildiou", from, to)
	assert.Error(t, err)
}

func TestSeries_IncludesMeasures(t *testing.T) {
	vy := &domain.Vineyard{
		ID: uuid.New(),
		Boundary: &domain.GeoJSON{RawMessage: []byte(`{"type":"Polygon","coordinates":[[[9.45,47.05],[9.46,47.05],[9.46,47.06],[9.45,47.06],[9.45,47.05]]]}`)},
	}
	mildiou := *protection.DiseaseByKey("mildiou")
	sprayDate := time.Date(2026, 5, 11, 9, 0, 0, 0, time.UTC)
	sprays := &fakeSpray{items: []domain.SprayApplication{{
		TaskID:        uuid.New(),
		AppliedAt:     sprayDate,
		TargetPestIDs: mildiou.PSMPestIDs,
		ProductIDs:    []string{"4090"},
	}}}
	vys := &fakeVineyards{v: vy}
	agro := &fakeAgrometeo{
		stations: []agrometeo.Station{{ID: 138, Name: "SARGANS", Lat: "47.054", Lng: "9.447"}},
		features: map[int][]agrometeo.ModelFeature{7: {{StationID: 138, Index: 0}}},
	}
	svc := protection.NewRiskService(vys, agro, sprays, &fakePSM{}, &fakePeriods{}, agrometeo.NewCache())
	from := time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 5, 13, 0, 0, 0, 0, time.UTC)
	res, err := svc.Series(context.Background(), vy.ID, "mildiou", from, to)
	require.NoError(t, err)
	require.Len(t, res.Measures, 1)
	assert.Equal(t, "spray", res.Measures[0].Kind)
	assert.WithinDuration(t, sprayDate, res.Measures[0].At, time.Second)
	assert.Equal(t, "4090", res.Measures[0].Label)
}
