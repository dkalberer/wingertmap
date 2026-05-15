# Pflanzenschutz-Ampel — Stufe 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** Detail-Tiefe: Pro Krankheit eine Trend-/Forecast-Chart + Massnahmen-Timeline in einem klickbaren Modal. Neuer Backend-Endpoint liefert Zeitreihen-Daten (mit aggressivem Cache); Frontend zeigt sie via Recharts. Damit hat der Winzer in der App den vollen "Detailliert"-Blick, den er sonst auf agrometeo.ch zusammenklickt.

**Architecture:** Backend bekommt einen neuen Service `SeriesService` der pro-Tag Agrometeo-Modell-Aufrufe parallelisiert (mit dem bestehenden Cache aus Stufe 1) und auch die Massnahmen-History (Spritzungen + Periods) der Vineyard zusammenführt. Frontend rendert beim Kachel-Klick ein `DiseaseDetailModal` mit `RechartsLineChart` und einer einfachen Liste der eigenen Massnahmen.

**Tech Stack:** Go 1.26 (chi v5, `errgroup`), React 18 + Recharts 3 + MUI Dialog. Bezug: Spec §7.2 + §9.1.

---

## File Structure

**Backend — Neu:**

| Datei | Verantwortung |
|---|---|
| `apps/backend/internal/protection/series.go` | `(s *RiskService).Series(ctx, vineyardID, diseaseKey, from, to) (*SeriesResponse, error)` |
| `apps/backend/internal/protection/series_test.go` | Tests gegen Fakes (parallele Calls verifizieren) |
| `apps/backend/internal/handler/disease_series.go` | Handler `GET .../disease-risk/{key}/series?from=&to=` |
| `apps/backend/internal/handler/disease_series_test.go` | Smoke-Test mit Stubs |

**Backend — Modifikationen:**

| Datei | Änderung |
|---|---|
| `apps/backend/main.go` | Neue Route registrieren |

**Frontend — Neu:**

| Datei | Verantwortung |
|---|---|
| `apps/frontend/src/api/protection.ts` | Erweiterung um `getDiseaseSeries(vineyardId, diseaseKey, from, to)` |
| `apps/frontend/src/components/Vineyard/DiseaseDetailModal.tsx` | Modal mit Chart + Massnahmen-Liste + Header (rawIndex/effective) |
| `apps/frontend/src/components/Vineyard/DiseaseDetailModal.test.tsx` | Vitest |

**Frontend — Modifikationen:**

| Datei | Änderung |
|---|---|
| `apps/frontend/src/types/index.ts` | Neue Typen `DiseaseSeriesPoint`, `DiseaseSeriesResponse`, `DiseaseMeasure` |
| `apps/frontend/src/components/Vineyard/DiseaseCard.tsx` | `onClick` Prop entgegennehmen, Card klickbar machen |
| `apps/frontend/src/components/Vineyard/ProtectionPanel.tsx` | Modal-State, klick auf Kachel öffnet Modal mit gewählter Krankheit |

---

### Task 1: Backend Series-Service

**Files:**
- Create: `apps/backend/internal/protection/series.go`
- Create: `apps/backend/internal/protection/series_test.go`

- [ ] **Step 1: Test schreiben**

```go
// apps/backend/internal/protection/series_test.go
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

// countingAgro counts how many FetchModelGeojson calls were made.
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
    to := time.Date(2026, 5, 13, 0, 0, 0, 0, time.UTC) // 4 days inclusive
    res, err := svc.Series(context.Background(), vy.ID, "mildiou", from, to)
    require.NoError(t, err)
    require.Len(t, res.Points, 4)
    assert.Equal(t, "mildiou", res.DiseaseKey)
    assert.Equal(t, "Falscher Mehltau", res.DiseaseName)
    assert.Equal(t, "SARGANS", res.StationName)
    // Cache miss for all 4 dates → 4 calls
    assert.EqualValues(t, 4, agro.calls.Load())
    // Each point has the model index and a derived level
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
        TaskID: uuid.New(), AppliedAt: sprayDate,
        TargetPestIDs: mildiou.PSMPestIDs,
        ProductID: ptrString("4090"),
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
}

func ptrString(s string) *string { return &s }
```

- [ ] **Step 2: Test ausführen, FAIL erwartet**

Run: `cd apps/backend && go test ./internal/protection/... -run TestSeries -timeout 30s`
Expected: FAIL — `(*RiskService).Series` existiert nicht.

- [ ] **Step 3: Service implementieren**

```go
// apps/backend/internal/protection/series.go
package protection

import (
    "context"
    "fmt"
    "sync"
    "time"

    "github.com/google/uuid"
    "wingert/backend/internal/agrometeo"
)

type SeriesPoint struct {
    Date  string  `json:"date"`  // YYYY-MM-DD
    Index float64 `json:"index"`
    Level string  `json:"level"`
}

type SeriesMeasure struct {
    Kind  string    `json:"kind"`              // "spray" | "dispenser-start" | "dispenser-end" | "mowing-pause-start" | "mowing-pause-end"
    At    time.Time `json:"at"`
    Label string    `json:"label,omitempty"`   // optional human-readable name (e.g. product name)
}

type SeriesResponse struct {
    VineyardID   uuid.UUID       `json:"vineyardId"`
    DiseaseKey   string          `json:"diseaseKey"`
    DiseaseName  string          `json:"diseaseName"`
    StationID    int             `json:"stationId"`
    StationName  string          `json:"stationName"`
    From         string          `json:"from"`
    To           string          `json:"to"`
    Points       []SeriesPoint   `json:"points"`
    Measures     []SeriesMeasure `json:"measures"`
}

const maxSeriesRangeDays = 30

// Series returns a daily-resolution time series of the Agrometeo model index
// for one disease over the given inclusive date range, plus the user's
// measures (sprays / period openings/closings) that fall within the range.
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

    points := make([]SeriesPoint, days)
    var wg sync.WaitGroup
    var firstErr error
    var mu sync.Mutex
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
                    mu.Lock()
                    if firstErr == nil {
                        firstErr = err
                    }
                    mu.Unlock()
                    return
                }
                s.cache.SetModel(d.AgrometeoModelID, date, f)
                feats = f
            }
            var feature agrometeo.ModelFeature
            for _, f := range feats {
                if f.StationID == nearest.ID {
                    feature = f
                    break
                }
            }
            idx := indexFor(*d, feature)
            points[i] = SeriesPoint{
                Date:  date.Format("2006-01-02"),
                Index: idx,
                Level: MapLevel(*d, idx),
            }
        }()
    }
    wg.Wait()
    if firstErr != nil {
        return nil, firstErr
    }

    measures, err := s.collectMeasures(*d, vineyardID, from, to)
    if err != nil {
        return nil, err
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
    }, nil
}

func (s *RiskService) collectMeasures(d Disease, vineyardID uuid.UUID, from, to time.Time) ([]SeriesMeasure, error) {
    var out []SeriesMeasure
    sprays, err := s.sprays.FindByVineyard(vineyardID, from)
    if err != nil {
        return nil, err
    }
    for _, sp := range sprays {
        if sp.AppliedAt.After(to.Add(24*time.Hour)) {
            continue
        }
        if !targetMatches(sp.TargetPestIDs, d.PSMPestIDs) {
            continue
        }
        label := ""
        if sp.ProductID != nil {
            label = *sp.ProductID
        }
        out = append(out, SeriesMeasure{Kind: "spray", At: sp.AppliedAt, Label: label})
    }
    return out, nil
}
```

- [ ] **Step 4: Test ausführen, PASS erwartet**

Run: `cd apps/backend && go test ./internal/protection/... -run TestSeries -timeout 30s -v`
Expected: 4 PASS.

---

### Task 2: Backend Series-Handler + Route

**Files:**
- Create: `apps/backend/internal/handler/disease_series.go`
- Create: `apps/backend/internal/handler/disease_series_test.go`
- Modify: `apps/backend/main.go` (Route)

- [ ] **Step 1: Handler-Test schreiben**

```go
// apps/backend/internal/handler/disease_series_test.go
package handler_test

import (
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"
    "time"

    "github.com/go-chi/chi/v5"
    "github.com/google/uuid"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    "wingert/backend/internal/agrometeo"
    "wingert/backend/internal/domain"
    "wingert/backend/internal/handler"
    "wingert/backend/internal/protection"
)

func TestDiseaseSeriesHandler_OK(t *testing.T) {
    vy := &domain.Vineyard{
        ID: uuid.New(),
        Boundary: &domain.GeoJSON{RawMessage: []byte(`{"type":"Polygon","coordinates":[[[9.45,47.05],[9.46,47.05],[9.46,47.06],[9.45,47.06],[9.45,47.05]]]}`)},
    }
    svc := protection.NewRiskService(
        &stubVineyards{v: vy},
        seriesAgroStub{},
        stubSprays{},
        stubPSM{},
        stubPeriods{},
        agrometeo.NewCache(),
    )
    h := handler.NewDiseaseHandler(svc)
    r := chi.NewRouter()
    r.Get("/api/vineyards/{id}/disease-risk/{key}/series", h.Series)

    rr := httptest.NewRecorder()
    today := time.Now().UTC().Truncate(24 * time.Hour)
    from := today.AddDate(0, 0, -3).Format("2006-01-02")
    to := today.Format("2006-01-02")
    url := "/api/vineyards/" + vy.ID.String() + "/disease-risk/mildiou/series?from=" + from + "&to=" + to
    r.ServeHTTP(rr, httptest.NewRequest("GET", url, nil))
    require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())

    var body protection.SeriesResponse
    require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &body))
    assert.Equal(t, "mildiou", body.DiseaseKey)
    assert.Len(t, body.Points, 4)
}

func TestDiseaseSeriesHandler_MissingDates(t *testing.T) {
    h := handler.NewDiseaseHandler(nil) // svc unused for this branch
    r := chi.NewRouter()
    r.Get("/api/vineyards/{id}/disease-risk/{key}/series", h.Series)
    rr := httptest.NewRecorder()
    r.ServeHTTP(rr, httptest.NewRequest("GET", "/api/vineyards/"+uuid.New().String()+"/disease-risk/mildiou/series", nil))
    assert.Equal(t, http.StatusBadRequest, rr.Code)
}

// seriesAgroStub returns a fixed feature for any model+date.
type seriesAgroStub struct{}

func (seriesAgroStub) FetchStations(_ interface{ Done() <-chan struct{} }) ([]agrometeo.Station, error) {
    return []agrometeo.Station{{ID: 138, Name: "SARGANS", Lat: "47.05", Lng: "9.45"}}, nil
}
```

**Note:** The above `seriesAgroStub` doesn't actually fit the `protection.AgrometeoAPI` interface (which uses `context.Context`, not the abbreviated form). Use this corrected version instead:

```go
type seriesAgroStub struct{}

func (seriesAgroStub) FetchStations(_ context.Context) ([]agrometeo.Station, error) {
    return []agrometeo.Station{{ID: 138, Name: "SARGANS", Lat: "47.05", Lng: "9.45"}}, nil
}
func (seriesAgroStub) FetchModelGeojson(_ context.Context, _ int, _ time.Time) ([]agrometeo.ModelFeature, error) {
    return []agrometeo.ModelFeature{{StationID: 138, Index: 50}}, nil
}
```

Make sure `context` is imported and remove the abbreviated stub.

- [ ] **Step 2: Test laufen lassen, FAIL erwartet**

Run: `cd apps/backend && go test ./internal/handler/... -run TestDiseaseSeriesHandler -timeout 30s`
Expected: FAIL — `(*DiseaseHandler).Series` does not exist.

- [ ] **Step 3: Handler implementieren**

```go
// apps/backend/internal/handler/disease_series.go
package handler

import (
    "net/http"
    "time"

    "github.com/go-chi/chi/v5"
    "github.com/google/uuid"
)

func (h *DiseaseHandler) Series(w http.ResponseWriter, r *http.Request) {
    id, err := uuid.Parse(chi.URLParam(r, "id"))
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid id")
        return
    }
    key := chi.URLParam(r, "key")
    if key == "" {
        writeError(w, http.StatusBadRequest, "missing disease key")
        return
    }
    fromStr := r.URL.Query().Get("from")
    toStr := r.URL.Query().Get("to")
    if fromStr == "" || toStr == "" {
        writeError(w, http.StatusBadRequest, "from and to are required")
        return
    }
    from, err := time.Parse("2006-01-02", fromStr)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid from date")
        return
    }
    to, err := time.Parse("2006-01-02", toStr)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid to date")
        return
    }
    res, err := h.svc.Series(r.Context(), id, key, from, to)
    if err != nil {
        writeError(w, http.StatusBadGateway, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, res)
}
```

- [ ] **Step 4: Route in main.go registrieren**

In `apps/backend/main.go`, neben der bestehenden `r.Get("/api/vineyards/{id}/disease-risk", diseaseH.Get)`-Zeile, hinzufügen:

```go
r.Get("/api/vineyards/{id}/disease-risk/{key}/series", diseaseH.Series)
```

- [ ] **Step 5: Tests laufen lassen, PASS erwartet**

```
cd apps/backend && go test ./internal/handler/... -run "TestDiseaseRisk|TestDiseaseSeries|TestPSM" -timeout 30s -v
cd apps/backend && go build ./...
```

Expected: alle tests pass, build clean.

---

### Task 3: Frontend-Typen + API erweitern

**Files:**
- Modify: `apps/frontend/src/types/index.ts`
- Modify: `apps/frontend/src/api/protection.ts`

- [ ] **Step 1: Typen ergänzen**

In `apps/frontend/src/types/index.ts`, nach den bestehenden DiseaseRiskResponse-Typen einfügen:

```ts
export interface DiseaseSeriesPoint {
  date: string
  index: number
  level: DiseaseLevel
}

export interface DiseaseMeasure {
  kind: string
  at: string
  label?: string
}

export interface DiseaseSeriesResponse {
  vineyardId: string
  diseaseKey: string
  diseaseName: string
  stationId: number
  stationName: string
  from: string
  to: string
  points: DiseaseSeriesPoint[]
  measures: DiseaseMeasure[]
}
```

- [ ] **Step 2: API-Helper schreiben**

In `apps/frontend/src/api/protection.ts` ergänzen:

```ts
import type { DiseaseRiskResponse, DiseaseSeriesResponse } from '../types'

// ... existing getDiseaseRisk stays …

export async function getDiseaseSeries(
  vineyardId: string,
  diseaseKey: string,
  from: string,
  to: string,
): Promise<DiseaseSeriesResponse> {
  const res = await fetch(
    `/api/vineyards/${vineyardId}/disease-risk/${encodeURIComponent(diseaseKey)}/series?from=${from}&to=${to}`,
    { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } },
  )
  if (!res.ok) throw new Error('Krankheits-Zeitreihe konnte nicht geladen werden')
  return res.json()
}
```

- [ ] **Step 3: Lint**

```
cd apps/frontend && pnpm lint
```

Expected: clean.

---

### Task 4: DiseaseDetailModal-Komponente

**Files:**
- Create: `apps/frontend/src/components/Vineyard/DiseaseDetailModal.tsx`
- Create: `apps/frontend/src/components/Vineyard/DiseaseDetailModal.test.tsx`

- [ ] **Step 1: Komponente schreiben**

```tsx
// apps/frontend/src/components/Vineyard/DiseaseDetailModal.tsx
import { useEffect, useState } from 'react'
import {
  Alert, Box, Chip, CircularProgress, Dialog, DialogContent, DialogTitle,
  IconButton, List, ListItem, ListItemText, Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import {
  CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from 'recharts'
import type { DiseaseResult, DiseaseSeriesResponse } from '../../types'
import { getDiseaseSeries } from '../../api/protection'

interface Props {
  vineyardId: string
  disease: DiseaseResult | null
  onClose: () => void
}

const RANGE_DAYS = 14

export default function DiseaseDetailModal({ vineyardId, disease, onClose }: Props) {
  const [data, setData] = useState<DiseaseSeriesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!disease) {
      setData(null)
      return
    }
    let cancelled = false
    const today = new Date()
    const from = new Date(today)
    from.setDate(today.getDate() - 7)
    const to = new Date(today)
    to.setDate(today.getDate() + 5)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    setLoading(true)
    setError(false)
    getDiseaseSeries(vineyardId, disease.key, fmt(from), fmt(to))
      .then((r) => { if (!cancelled) setData(r) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [vineyardId, disease])

  if (!disease) return null

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{disease.name}</span>
        <IconButton onClick={onClose} size="small" aria-label="Schliessen">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip label={`Effektiv: ${disease.effectiveLevel}`} size="small" />
          {disease.rawLevel !== disease.effectiveLevel && (
            <Chip label={`Modell: ${disease.rawLevel}`} size="small" variant="outlined" />
          )}
          {disease.recommendation && (
            <Typography variant="caption" color="text.secondary">
              {disease.recommendation}
            </Typography>
          )}
        </Box>

        {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>}
        {error && <Alert severity="warning">Zeitreihe nicht verfügbar.</Alert>}

        {data && (
          <>
            <Typography variant="overline" color="text.secondary">
              Modell-Verlauf — Station {data.stationName}
            </Typography>
            <Box sx={{ width: '100%', height: 220, mb: 2 }}>
              <ResponsiveContainer>
                <LineChart data={data.points} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                  <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} fontSize={11} />
                  <YAxis fontSize={11} />
                  <RTooltip />
                  <Line type="monotone" dataKey="index" stroke="#7e57c2" dot={false} strokeWidth={2} />
                  {data.measures.map((m) => {
                    const day = m.at.slice(0, 10)
                    const pt = data.points.find((p) => p.date === day)
                    if (!pt) return null
                    return <ReferenceDot key={m.at} x={day} y={pt.index} r={5} fill="#1976d2" stroke="#fff" />
                  })}
                </LineChart>
              </ResponsiveContainer>
            </Box>

            <Typography variant="overline" color="text.secondary">Eigene Massnahmen</Typography>
            {data.measures.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                Keine Massnahmen im Zeitraum erfasst.
              </Typography>
            ) : (
              <List dense>
                {data.measures.map((m) => (
                  <ListItem key={m.at} disablePadding>
                    <ListItemText
                      primary={`${m.kind === 'spray' ? 'Spritzung' : m.kind}${m.label ? ' · ' + m.label : ''}`}
                      secondary={new Date(m.at).toLocaleString('de-CH')}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Test schreiben**

```tsx
// apps/frontend/src/components/Vineyard/DiseaseDetailModal.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DiseaseDetailModal from './DiseaseDetailModal'
import * as protectionApi from '../../api/protection'
import type { DiseaseResult } from '../../types'

vi.mock('../../api/protection')

const mildiou: DiseaseResult = {
  key: 'mildiou', name: 'Falscher Mehltau', modelId: 7,
  rawIndex: 226, rawLevel: 'rot', effectiveIndex: 226, effectiveLevel: 'rot',
}

describe('DiseaseDetailModal', () => {
  beforeEach(() => vi.resetAllMocks())

  it('does not render when disease is null', () => {
    render(<DiseaseDetailModal vineyardId="v1" disease={null} onClose={() => {}} />)
    expect(screen.queryByText('Falscher Mehltau')).not.toBeInTheDocument()
  })

  it('shows the disease and renders the chart with measures', async () => {
    vi.mocked(protectionApi.getDiseaseSeries).mockResolvedValue({
      vineyardId: 'v1', diseaseKey: 'mildiou', diseaseName: 'Falscher Mehltau',
      stationId: 138, stationName: 'SARGANS', from: '2026-05-06', to: '2026-05-18',
      points: [
        { date: '2026-05-06', index: 0, level: 'grün' },
        { date: '2026-05-07', index: 120, level: 'gelb' },
        { date: '2026-05-12', index: 220, level: 'rot' },
      ],
      measures: [{ kind: 'spray', at: '2026-05-08T07:00:00Z', label: '4090' }],
    })

    render(<DiseaseDetailModal vineyardId="v1" disease={mildiou} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByText('Falscher Mehltau')).toBeInTheDocument())
    await waitFor(() =>
      expect(screen.getByText(/Modell-Verlauf — Station SARGANS/)).toBeInTheDocument(),
    )
    expect(screen.getByText(/Spritzung · 4090/)).toBeInTheDocument()
  })

  it('shows an alert when the API call fails', async () => {
    vi.mocked(protectionApi.getDiseaseSeries).mockRejectedValue(new Error('boom'))
    render(<DiseaseDetailModal vineyardId="v1" disease={mildiou} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByText(/Zeitreihe nicht verfügbar/)).toBeInTheDocument())
  })
})
```

- [ ] **Step 3: Test laufen lassen**

```
cd apps/frontend && pnpm test DiseaseDetailModal -- --run
```

Expected: 3 tests pass.

**Note on Recharts in jsdom:** Recharts uses `ResponsiveContainer` which depends on `ResizeObserver`. If the test fails with "ResizeObserver is not defined", add to `apps/frontend/src/test-setup.ts` (or the existing setup file):

```ts
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver = ResizeObserverMock
```

Look for an existing setup file (`vitest.config.ts` references it) and append the polyfill there if needed.

---

### Task 5: DiseaseCard klickbar + Panel öffnet Modal

**Files:**
- Modify: `apps/frontend/src/components/Vineyard/DiseaseCard.tsx`
- Modify: `apps/frontend/src/components/Vineyard/ProtectionPanel.tsx`
- Modify: `apps/frontend/src/components/Vineyard/DiseaseCard.test.tsx` (optionaler Klick-Test)

- [ ] **Step 1: DiseaseCard onClick-Prop ergänzen**

In `apps/frontend/src/components/Vineyard/DiseaseCard.tsx`:

```tsx
interface Props {
  disease: DiseaseResult
  onClick?: () => void
}

export default function DiseaseCard({ disease, onClick }: Props) {
  // … existing logic …

  return (
    <Card
      variant="outlined"
      sx={{ height: '100%', cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      {/* CardContent unverändert */}
    </Card>
  )
}
```

- [ ] **Step 2: ProtectionPanel mit Modal-State**

In `apps/frontend/src/components/Vineyard/ProtectionPanel.tsx`:

```tsx
import { useEffect, useState } from 'react'
import type { DiseaseResult, DiseaseRiskResponse } from '../../types'
import DiseaseDetailModal from './DiseaseDetailModal'

// ... existing imports & component header ...

export default function ProtectionPanel({ vineyardId }: Props) {
  const [data, setData] = useState<DiseaseRiskResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState<DiseaseResult | null>(null)

  // existing useEffect unchanged ...

  // existing loading / error returns unchanged ...

  return (
    <Box>
      {/* existing header + grid */}
      <Grid container spacing={1.5}>
        {data.diseases.map((d) => (
          <Grid key={d.key} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <DiseaseCard disease={d} onClick={() => setSelected(d)} />
          </Grid>
        ))}
      </Grid>

      {data.psmSyncStale && /* existing stale banner */}

      <DiseaseDetailModal
        vineyardId={vineyardId}
        disease={selected}
        onClose={() => setSelected(null)}
      />
    </Box>
  )
}
```

- [ ] **Step 3: Lint + Tests**

```
cd apps/frontend && pnpm lint
cd apps/frontend && pnpm test -- --run
```

Expected: lint clean, alle tests pass (≥ 39 — 36 von vorher + 3 DiseaseDetailModal).

- [ ] **Step 4: Build**

```
cd apps/frontend && pnpm build
```

Expected: clean build.

---

## Self-Review

**Spec-Coverage (§7.2, §9.1, §9.3):**
- Endpoint `/disease-risk/{key}/series?from=&to=` → Tasks 1, 2
- 14-Tage-Verlauf mit Forecast → Task 4 (7d zurück + 5d forecast = 13 Tage)
- Massnahmen-Timeline pro Krankheit → Task 1 (Service inkludiert sprays) + Task 4 (List)
- Klick auf Kachel öffnet Detail-Modal → Task 5

**Bewusst NICHT in Stufe 3:**
- Schwellwert-Plausibilisierung via `/api/models/{id}/legend` — Risiko-R5 aus der Spec; aktuell sind die Schwellwerte in `protection.Config` hardcoded und decken die Agrometeo-Legenden ab. Nachladbar machen lohnt erst, wenn sich tatsächlich Werte ändern.
- "Externer Link → agrometeo.ch" Button im Modal — Nice-to-have.
- Dispenser-/Mahd-Pause-Massnahmen werden noch nicht in der `Series.Measures` aufgeführt (S1 hat Sprays). Erweiterung leicht, aber kein Stufe-3-Kernziel.

**Placeholder/Konsistenz:**
- Keine TBD/FIXME im Plan.
- Series-Endpoint hardcoded auf 30 Tage max — verhindert Stürme.
- Frontend nutzt nativen `Date`-API für from/to (toISOString().slice(0,10)) — konsistent mit Server-Format.
- Recharts `ReferenceDot` mit fehlendem Punkt-Lookup-Schutz (silent skip).

**Risiken:**
- Parallele Agrometeo-Calls: 14 gleichzeitige HTTP-Requests gegen die externe API. Bei flaky Verhalten könnte Rate-Limiting greifen. Cache fängt Wiederholungen ab; für Erst-Aufruf ist 14 Calls vertretbar.
- jsdom + Recharts brauchen ResizeObserver-Polyfill — im Plan dokumentiert.

---

**Nächster Schritt:** Subagent-driven execution.
