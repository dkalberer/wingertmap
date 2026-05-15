package protection_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"wingert/backend/internal/agrometeo"
	"wingert/backend/internal/domain"
	"wingert/backend/internal/protection"
)

// ── fakes ─────────────────────────────────────────────────────────

type fakeVineyards struct{ v *domain.Vineyard }

func (f *fakeVineyards) GetByID(uuid.UUID) (*domain.Vineyard, error) { return f.v, nil }
func (f *fakeVineyards) Create(string, string, *domain.GeoJSON, uuid.UUID) (*domain.Vineyard, error) {
	return nil, nil
}
func (f *fakeVineyards) ListByOwner(uuid.UUID) ([]domain.Vineyard, error) { return nil, nil }
func (f *fakeVineyards) Update(uuid.UUID, string, string, *domain.GeoJSON) error { return nil }
func (f *fakeVineyards) Delete(uuid.UUID) error                                  { return nil }

type fakeAgrometeo struct {
	stations []agrometeo.Station
	features map[int][]agrometeo.ModelFeature
}

func (f *fakeAgrometeo) FetchStations(context.Context) ([]agrometeo.Station, error) {
	return f.stations, nil
}
func (f *fakeAgrometeo) FetchModelGeojson(_ context.Context, modelID int, _ time.Time) ([]agrometeo.ModelFeature, error) {
	return f.features[modelID], nil
}
func (f *fakeAgrometeo) FetchHourlyWeather(_ context.Context, _ int, _, _ time.Time) ([]agrometeo.HourlyPoint, error) {
	return nil, nil
}

type fakeSpray struct{ items []domain.SprayApplication }

func (f *fakeSpray) Create(domain.SprayApplication) error { return nil }
func (f *fakeSpray) FindByVineyard(uuid.UUID, time.Time) ([]domain.SprayApplication, error) {
	return f.items, nil
}

type fakePSM struct{ pestsBySub map[uuid.UUID][]uuid.UUID }

func (f *fakePSM) GetPestsForSubstances(subs []uuid.UUID) ([]uuid.UUID, error) {
	seen := map[uuid.UUID]struct{}{}
	out := []uuid.UUID{}
	for _, s := range subs {
		for _, p := range f.pestsBySub[s] {
			if _, ok := seen[p]; !ok {
				seen[p] = struct{}{}
				out = append(out, p)
			}
		}
	}
	return out, nil
}
func (f *fakePSM) SearchProducts(string, int) ([]domain.PSMProduct, error)     { return nil, nil }
func (f *fakePSM) GetProduct(string) (*domain.PSMProduct, error)               { return nil, nil }
func (f *fakePSM) SearchSubstances(string, int) ([]domain.PSMSubstance, error) { return nil, nil }
func (f *fakePSM) UpsertBatch(domain.PSMBatch) error                           { return nil }
func (f *fakePSM) Meta() (*domain.PSMSyncMeta, error)                          { return nil, nil }
func (f *fakePSM) SetMeta(domain.PSMSyncMeta) error                            { return nil }

type fakePSMWithMeta struct {
	fakePSM
	meta *domain.PSMSyncMeta
}

func (f *fakePSMWithMeta) Meta() (*domain.PSMSyncMeta, error) { return f.meta, nil }

type fakePeriods struct{ active map[domain.ProtectionPeriodKind]*domain.ProtectionPeriod }

func (f *fakePeriods) Create(domain.ProtectionPeriod) error { return nil }
func (f *fakePeriods) FindActive(_ uuid.UUID, kind domain.ProtectionPeriodKind) (*domain.ProtectionPeriod, error) {
	return f.active[kind], nil
}
func (f *fakePeriods) CloseLatest(uuid.UUID, domain.ProtectionPeriodKind, uuid.UUID, time.Time) error {
	return nil
}
func (f *fakePeriods) LatestMaehenTask(_ uuid.UUID) (*time.Time, error) { return nil, nil }

// ── test ─────────────────────────────────────────────────────────

func TestService_Compute_Sargans_NoMeasures(t *testing.T) {
	vy := &domain.Vineyard{
		ID: uuid.New(),
		Boundary: &domain.GeoJSON{RawMessage: []byte(`{"type":"Polygon","coordinates":[[[9.45,47.05],[9.46,47.05],[9.46,47.06],[9.45,47.06],[9.45,47.05]]]}`)},
	}
	vys := &fakeVineyards{v: vy}
	agro := &fakeAgrometeo{
		stations: []agrometeo.Station{{ID: 138, Name: "SARGANS", Lat: "47.054", Lng: "9.447"}},
		features: map[int][]agrometeo.ModelFeature{
			7:  {{StationID: 138, Index: 226.86}},
			8:  {{StationID: 138, Index: 56.89}},
			11: {{StationID: 138, Index: 0}},
			12: {{StationID: 138, Index: 560}},
			14: {{StationID: 138, Index: 65}},
			15: {},
			16: {{StationID: 138, Index: 1676, Risikolevel: ptrInt(3)}},
			9:  {{StationID: 138, Index: 48}},
		},
	}
	svc := protection.NewRiskService(vys, agro, &fakeSpray{}, &fakePSM{}, &fakePeriods{}, agrometeo.NewCache())
	res, err := svc.Compute(context.Background(), vy.ID)
	require.NoError(t, err)
	assert.Equal(t, "SARGANS", res.StationName)

	var mildiou *protection.DiseaseResult
	for i := range res.Diseases {
		if res.Diseases[i].Key == "mildiou" {
			mildiou = &res.Diseases[i]
		}
	}
	require.NotNil(t, mildiou)
	assert.Equal(t, "rot", mildiou.EffectiveLevel)

	require.NotNil(t, res.Phenology)
	assert.Contains(t, res.Phenology.Label, "BBCH 60-69")
}

func TestService_Compute_PSMStaleness(t *testing.T) {
	vy := &domain.Vineyard{
		ID: uuid.New(),
		Boundary: &domain.GeoJSON{RawMessage: []byte(`{"type":"Polygon","coordinates":[[[9.45,47.05],[9.46,47.05],[9.46,47.06],[9.45,47.06],[9.45,47.05]]]}`)},
	}
	vys := &fakeVineyards{v: vy}
	agro := &fakeAgrometeo{
		stations: []agrometeo.Station{{ID: 138, Name: "SARGANS", Lat: "47.054", Lng: "9.447"}},
		features: map[int][]agrometeo.ModelFeature{},
	}
	staleAt := time.Now().Add(-90 * 24 * time.Hour)
	psmFake := &fakePSMWithMeta{meta: &domain.PSMSyncMeta{LastSyncAt: staleAt, Status: "ok"}}
	svc := protection.NewRiskService(vys, agro, &fakeSpray{}, psmFake, &fakePeriods{}, agrometeo.NewCache())
	res, err := svc.Compute(context.Background(), vy.ID)
	require.NoError(t, err)
	assert.True(t, res.PSMSyncStale, "expected PSMSyncStale=true for 90-day-old data")
	require.NotNil(t, res.PSMSyncAt)
	assert.WithinDuration(t, staleAt, *res.PSMSyncAt, time.Second)
}

func TestService_Compute_PSMFresh(t *testing.T) {
	vy := &domain.Vineyard{
		ID: uuid.New(),
		Boundary: &domain.GeoJSON{RawMessage: []byte(`{"type":"Polygon","coordinates":[[[9.45,47.05],[9.46,47.05],[9.46,47.06],[9.45,47.06],[9.45,47.05]]]}`)},
	}
	vys := &fakeVineyards{v: vy}
	agro := &fakeAgrometeo{stations: []agrometeo.Station{{ID: 138, Name: "SARGANS", Lat: "47.054", Lng: "9.447"}}}
	psmFake := &fakePSMWithMeta{meta: &domain.PSMSyncMeta{LastSyncAt: time.Now().Add(-5 * 24 * time.Hour), Status: "ok"}}
	svc := protection.NewRiskService(vys, agro, &fakeSpray{}, psmFake, &fakePeriods{}, agrometeo.NewCache())
	res, err := svc.Compute(context.Background(), vy.ID)
	require.NoError(t, err)
	assert.False(t, res.PSMSyncStale)
}
