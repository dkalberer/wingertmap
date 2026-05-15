# Pflanzenschutz-Ampel — Stufe 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Stufe 2 baut auf der Stufe-1-Foundation auf: Auto-Anlage/-Schliessung von Schutzperioden bei Dispenser-/Mahd-Pause-Tasks, ein vollwertiges Pflanzenschutz-Panel im Frontend (Kachel-Grid pro Krankheit) auf der Vineyard-Detail-Seite, periodischer PSM-Sync via Cron, und ein Stale-Data-Banner bei veralteten PSM-Daten.

**Architecture:** Backend bekommt ein Service-Layer-Hook im Task-Create-Pfad, der je nach Subtyp eine `protection_periods`-Zeile öffnet oder schliesst. PSM-Sync läuft in einer Goroutine mit `time.Ticker`. Frontend bekommt ein neues `ProtectionPanel`-Component, das `/disease-risk` konsumiert und Kacheln rendert; ein optionaler `PSMStaleBanner` zeigt Datenstand-Warnungen. `ProtectionBadge` bleibt für die Karten-Übersicht; `VineyardDetail` ersetzt den dortigen Badge durch das neue Panel.

**Tech Stack:** Go 1.26 (chi v5, GORM, `time.Ticker`), React 18 (TypeScript, MUI v7, Vitest). Bezug: `docs/superpowers/specs/2026-05-13-pflanzenschutz-ampel-design.md`, Stufe-1-Plan: `docs/superpowers/plans/2026-05-13-pflanzenschutz-ampel-stufe1.md`.

---

## File Structure

**Backend — Neue Dateien:**

| Datei | Verantwortung |
|---|---|
| `apps/backend/internal/protection/period_writer.go` | `PeriodWriter` — Service-Hook, der nach Task-Create eine Protection-Period öffnet/schliesst je Subtyp |
| `apps/backend/internal/protection/period_writer_test.go` | Unit-Tests mit Fakes |
| `apps/backend/internal/psm/scheduler.go` | `Scheduler.Start(ctx)` — Goroutine mit `time.Ticker`, ruft `Sync` periodisch auf |
| `apps/backend/internal/psm/scheduler_test.go` | Test mit kurzem Interval und fake repo |

**Backend — Modifikationen:**

| Datei | Änderung |
|---|---|
| `apps/backend/internal/handler/task.go` | TaskHandler nimmt zusätzlich einen `*protection.PeriodWriter`; ruft `OnTaskCreated` nach erfolgreichem `repo.Create` |
| `apps/backend/main.go` | `PeriodWriter` initialisieren, an TaskHandler weitergeben; `psm.Scheduler` starten |
| `apps/backend/internal/protection/service.go` | `RiskResponse` um `PSMSyncStale bool` und `PSMSyncAt *time.Time` erweitern; bei `Compute` aus `psm.Meta()` lesen |

**Frontend — Neue Dateien:**

| Datei | Verantwortung |
|---|---|
| `apps/frontend/src/components/Vineyard/ProtectionPanel.tsx` | Hauptpanel: Header (Station + Phänologie) + DiseaseGrid + Footer (Stale-Banner) |
| `apps/frontend/src/components/Vineyard/ProtectionPanel.test.tsx` | Vitest mit gemockten `getDiseaseRisk` |
| `apps/frontend/src/components/Vineyard/DiseaseCard.tsx` | Eine Kachel: Icon, Name, EffectiveAmpel, Raw-Hinweis falls abweichend, 1-Zeilen-Empfehlung, "Massnahme" |
| `apps/frontend/src/components/Vineyard/DiseaseCard.test.tsx` | Vitest |

**Frontend — Modifikationen:**

| Datei | Änderung |
|---|---|
| `apps/frontend/src/types/index.ts` | `DiseaseRiskResponse` um `psmSyncStale?: boolean` und `psmSyncAt?: string` |
| `apps/frontend/src/components/Vineyard/VineyardDetail.tsx` | `ProtectionBadge` durch `ProtectionPanel` ersetzen |

`ProtectionBadge` bleibt unverändert — wird weiterhin in Vineyard-Liste / Karten-Übersicht verwendet.

---

### Task 1: PeriodWriter — Auto-Anlage von Protection-Perioden

**Files:**
- Create: `apps/backend/internal/protection/period_writer.go`
- Create: `apps/backend/internal/protection/period_writer_test.go`

- [ ] **Step 1: Failing Test schreiben**

```go
// apps/backend/internal/protection/period_writer_test.go
package protection_test

import (
    "testing"
    "time"

    "github.com/google/uuid"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    "wingert/backend/internal/domain"
    "wingert/backend/internal/protection"
)

type recordingPeriods struct {
    created  []domain.ProtectionPeriod
    closed   []struct {
        vineyardID uuid.UUID
        kind       domain.ProtectionPeriodKind
        endTaskID  uuid.UUID
        endAt      time.Time
    }
    active map[domain.ProtectionPeriodKind]*domain.ProtectionPeriod
}

func (r *recordingPeriods) Create(p domain.ProtectionPeriod) error {
    r.created = append(r.created, p)
    return nil
}
func (r *recordingPeriods) FindActive(_ uuid.UUID, kind domain.ProtectionPeriodKind) (*domain.ProtectionPeriod, error) {
    if r.active == nil {
        return nil, nil
    }
    return r.active[kind], nil
}
func (r *recordingPeriods) CloseLatest(vineyardID uuid.UUID, kind domain.ProtectionPeriodKind, endTaskID uuid.UUID, endAt time.Time) error {
    r.closed = append(r.closed, struct {
        vineyardID uuid.UUID
        kind       domain.ProtectionPeriodKind
        endTaskID  uuid.UUID
        endAt      time.Time
    }{vineyardID, kind, endTaskID, endAt})
    return nil
}

var traubenwicklerPests = []uuid.UUID{
    uuid.MustParse("884fbf9b-a098-4936-9caa-57056026d69e"),
    uuid.MustParse("5ac77f67-4abf-460f-825c-a82d635bda38"),
    uuid.MustParse("711c42ab-e781-4501-b0f4-cfbbdc89c83f"),
}

func TestPeriodWriter_DispenserHaengenOpensPeriod(t *testing.T) {
    rec := &recordingPeriods{}
    w := protection.NewPeriodWriter(rec)

    vyID := uuid.New()
    sub := "dispenser-haengen"
    task := &domain.Task{
        ID:         uuid.New(),
        VineyardID: &vyID,
        Subtype:    &sub,
        CreatedAt:  time.Now(),
    }
    require.NoError(t, w.OnTaskCreated(task))
    require.Len(t, rec.created, 1)
    p := rec.created[0]
    assert.Equal(t, vyID, p.VineyardID)
    assert.Equal(t, domain.ProtectionPeriodDispenser, p.Kind)
    assert.Equal(t, task.ID, p.StartTaskID)
    assert.ElementsMatch(t, traubenwicklerPests, p.TargetPestIDs)
}

func TestPeriodWriter_DispenserEntfernenClosesPeriod(t *testing.T) {
    rec := &recordingPeriods{}
    w := protection.NewPeriodWriter(rec)

    vyID := uuid.New()
    sub := "dispenser-entfernen"
    task := &domain.Task{
        ID:         uuid.New(),
        VineyardID: &vyID,
        Subtype:    &sub,
        CreatedAt:  time.Now(),
    }
    require.NoError(t, w.OnTaskCreated(task))
    require.Len(t, rec.closed, 1)
    c := rec.closed[0]
    assert.Equal(t, vyID, c.vineyardID)
    assert.Equal(t, domain.ProtectionPeriodDispenser, c.kind)
    assert.Equal(t, task.ID, c.endTaskID)
}

func TestPeriodWriter_MahdPauseStartOpensPeriod(t *testing.T) {
    rec := &recordingPeriods{}
    w := protection.NewPeriodWriter(rec)

    vyID := uuid.New()
    sub := "mahd-pause-start"
    task := &domain.Task{
        ID:         uuid.New(),
        VineyardID: &vyID,
        Subtype:    &sub,
        CreatedAt:  time.Now(),
    }
    require.NoError(t, w.OnTaskCreated(task))
    require.Len(t, rec.created, 1)
    assert.Equal(t, domain.ProtectionPeriodMowingPause, rec.created[0].Kind)
}

func TestPeriodWriter_OtherSubtypesNoOp(t *testing.T) {
    rec := &recordingPeriods{}
    w := protection.NewPeriodWriter(rec)
    vyID := uuid.New()
    sub := "spritzung"
    task := &domain.Task{ID: uuid.New(), VineyardID: &vyID, Subtype: &sub, CreatedAt: time.Now()}
    require.NoError(t, w.OnTaskCreated(task))
    assert.Empty(t, rec.created)
    assert.Empty(t, rec.closed)
}

func TestPeriodWriter_NoVineyardIDIsError(t *testing.T) {
    rec := &recordingPeriods{}
    w := protection.NewPeriodWriter(rec)
    sub := "dispenser-haengen"
    task := &domain.Task{ID: uuid.New(), Subtype: &sub, CreatedAt: time.Now()}
    err := w.OnTaskCreated(task)
    assert.Error(t, err)
}

func TestPeriodWriter_NilTaskOrSubtypeNoOp(t *testing.T) {
    rec := &recordingPeriods{}
    w := protection.NewPeriodWriter(rec)
    assert.NoError(t, w.OnTaskCreated(nil))
    require.NoError(t, w.OnTaskCreated(&domain.Task{}))
    assert.Empty(t, rec.created)
    assert.Empty(t, rec.closed)
}
```

- [ ] **Step 2: Tests laufen lassen, FAIL erwartet**

Run: `cd apps/backend && go test ./internal/protection/... -run TestPeriodWriter -timeout 30s`
Expected: FAIL — `protection.NewPeriodWriter`, `OnTaskCreated` existieren nicht.

- [ ] **Step 3: PeriodWriter implementieren**

```go
// apps/backend/internal/protection/period_writer.go
package protection

import (
    "fmt"

    "github.com/google/uuid"
    "wingert/backend/internal/domain"
)

// PeriodWriter handles the lifecycle of protection_periods rows in response
// to task-create events for Pflanzenschutz subtypes.
type PeriodWriter struct {
    periods domain.ProtectionPeriodRepository
}

func NewPeriodWriter(periods domain.ProtectionPeriodRepository) *PeriodWriter {
    return &PeriodWriter{periods: periods}
}

// OnTaskCreated inspects the task's Subtype and either opens a new
// protection_periods row (for *-start/*-haengen subtypes) or closes the
// most recent active row of the matching kind (for *-ende/*-entfernen).
// No-op for tasks without a relevant subtype.
func (w *PeriodWriter) OnTaskCreated(t *domain.Task) error {
    if t == nil || t.Subtype == nil {
        return nil
    }
    sub := *t.Subtype

    var kind domain.ProtectionPeriodKind
    open := false
    targets := []uuid.UUID(nil)

    switch sub {
    case "dispenser-haengen":
        kind = domain.ProtectionPeriodDispenser
        open = true
        targets = traubenwicklerPestIDs()
    case "dispenser-entfernen":
        kind = domain.ProtectionPeriodDispenser
    case "mahd-pause-start":
        kind = domain.ProtectionPeriodMowingPause
        open = true
        targets = boisNoirPestIDs()
    case "mahd-pause-ende":
        kind = domain.ProtectionPeriodMowingPause
    default:
        return nil
    }

    if t.VineyardID == nil {
        return fmt.Errorf("subtype %q requires a vineyard_id on the task", sub)
    }

    if open {
        return w.periods.Create(domain.ProtectionPeriod{
            ID:            uuid.New(),
            VineyardID:    *t.VineyardID,
            Kind:          kind,
            StartTaskID:   t.ID,
            StartAt:       t.CreatedAt,
            TargetPestIDs: targets,
        })
    }
    return w.periods.CloseLatest(*t.VineyardID, kind, t.ID, t.CreatedAt)
}

// traubenwicklerPestIDs returns the Traubenwickler-related PSM-Pest UUIDs as
// configured in protection.Diseases. Centralized here so PeriodWriter and
// other places stay in sync.
func traubenwicklerPestIDs() []uuid.UUID {
    d := DiseaseByKey("traubenwickler")
    if d == nil {
        return nil
    }
    out := make([]uuid.UUID, len(d.PSMPestIDs))
    copy(out, d.PSMPestIDs)
    return out
}

func boisNoirPestIDs() []uuid.UUID {
    d := DiseaseByKey("bois-noir")
    if d == nil {
        return nil
    }
    out := make([]uuid.UUID, len(d.PSMPestIDs))
    copy(out, d.PSMPestIDs)
    return out
}
```

- [ ] **Step 4: Tests laufen lassen, PASS erwartet**

Run: `cd apps/backend && go test ./internal/protection/... -run TestPeriodWriter -timeout 30s -v`
Expected: 6 PASS (DispenserHaengenOpensPeriod, DispenserEntfernenClosesPeriod, MahdPauseStartOpensPeriod, OtherSubtypesNoOp, NoVineyardIDIsError, NilTaskOrSubtypeNoOp).

---

### Task 2: TaskHandler ruft PeriodWriter

**Files:**
- Modify: `apps/backend/internal/handler/task.go`

- [ ] **Step 1: TaskHandler-Konstruktor erweitern**

In `apps/backend/internal/handler/task.go`:

```go
type TaskHandler struct {
    repo    domain.TaskRepository
    sprays  domain.SprayRepository
    periods *protection.PeriodWriter
}

func NewTaskHandler(repo domain.TaskRepository, sprays domain.SprayRepository, periods *protection.PeriodWriter) *TaskHandler {
    return &TaskHandler{repo: repo, sprays: sprays, periods: periods}
}
```

Imports erweitern:

```go
import (
    // existing imports …
    "wingert/backend/internal/protection"
)
```

- [ ] **Step 2: OnTaskCreated nach Task-Erstellung aufrufen**

In `(h *TaskHandler) Create(...)`, nach dem erfolgreichen `h.repo.Create(p)`:

```go
task, err := h.repo.Create(p)
if err != nil {
    writeInternalError(w, err)
    return
}

if err := h.periods.OnTaskCreated(task); err != nil {
    writeInternalError(w, err)
    return
}

// existing spray persistence …
```

Wichtig: Reihenfolge ist `h.periods.OnTaskCreated` VOR der Spray-Persistierung — bei einem Fehler im Period-Hook gibt's einen 500, der Caller kann dann reparieren. Spray-Persistierung läuft danach unabhängig.

- [ ] **Step 3: Vorhandenen Test anpassen**

`apps/backend/internal/handler/task_test.go` (Task 11 aus Stufe 1) ruft `handler.NewTaskHandler(taskStore, sprayStore)` mit zwei Argumenten auf — neu sind drei. Anpassen:

```go
import (
    "wingert/backend/internal/protection"
)

// in TestCreateTask_WithSpray:
periodStore := store.NewProtectionPeriodStore(db)
periodWriter := protection.NewPeriodWriter(periodStore)
h := handler.NewTaskHandler(taskStore, sprayStore, periodWriter)
```

- [ ] **Step 4: Build und Test**

```
cd apps/backend && go build ./...
cd apps/backend && go test ./internal/handler/... -run "TestPSM|TestDiseaseRisk" -timeout 30s -v
```

Expected: build clean, non-Docker handler tests pass (Docker-test `TestCreateTask_WithSpray` läuft nur lokal mit Docker).

---

### Task 3: Period-Wiring in main.go

**Files:**
- Modify: `apps/backend/main.go`

- [ ] **Step 1: PeriodWriter konstruieren**

In `main.go` nach der bestehenden `protectionStore`-Zeile:

```go
periodWriter := protection.NewPeriodWriter(protectionStore)
```

- [ ] **Step 2: TaskHandler-Aufruf aktualisieren**

Bestehende Zeile `taskH := handler.NewTaskHandler(taskStore, sprayStore)` ersetzen durch:

```go
taskH := handler.NewTaskHandler(taskStore, sprayStore, periodWriter)
```

- [ ] **Step 3: Build prüfen**

```
cd apps/backend && go build ./... && go vet ./...
```

Expected: clean.

---

### Task 4: PSM-Scheduler — periodischer Sync

**Files:**
- Create: `apps/backend/internal/psm/scheduler.go`
- Create: `apps/backend/internal/psm/scheduler_test.go`

- [ ] **Step 1: Failing Test schreiben**

```go
// apps/backend/internal/psm/scheduler_test.go
package psm_test

import (
    "archive/zip"
    "bytes"
    "context"
    "io"
    "net/http"
    "net/http/httptest"
    "os"
    "sync/atomic"
    "testing"
    "time"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    "wingert/backend/internal/psm"
)

func TestScheduler_TicksAtInterval(t *testing.T) {
    raw, err := os.ReadFile("testdata/sample.xml")
    require.NoError(t, err)
    var buf bytes.Buffer
    zw := zip.NewWriter(&buf)
    w, _ := zw.Create("PublicationData.xml")
    _, _ = io.Copy(w, bytes.NewReader(raw))
    _ = zw.Close()
    zipBytes := buf.Bytes()

    var hits int32
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        atomic.AddInt32(&hits, 1)
        w.Header().Set("Content-Type", "application/zip")
        _, _ = w.Write(zipBytes)
    }))
    defer server.Close()

    repo := &fakeRepo{}
    svc := psm.NewSyncService(repo, server.URL, rebenForSync)
    svc.SetMinSyncSpacing(1 * time.Millisecond) // allow each tick to actually sync

    sched := psm.NewScheduler(svc, 30*time.Millisecond)

    ctx, cancel := context.WithCancel(context.Background())
    sched.Start(ctx)

    // Wait long enough to expect at least 3 ticks
    time.Sleep(120 * time.Millisecond)
    cancel()
    sched.Wait()

    got := atomic.LoadInt32(&hits)
    assert.GreaterOrEqual(t, got, int32(3), "expected at least 3 syncs, got %d", got)
}

func TestScheduler_StopsOnContextCancel(t *testing.T) {
    repo := &fakeRepo{}
    svc := psm.NewSyncService(repo, "http://invalid.example", rebenForSync)
    sched := psm.NewScheduler(svc, 10*time.Millisecond)

    ctx, cancel := context.WithCancel(context.Background())
    sched.Start(ctx)
    cancel()
    sched.Wait()
    // No assertion on count — just confirm Wait returns promptly.
}
```

- [ ] **Step 2: Tests ausführen, FAIL erwartet**

Run: `cd apps/backend && go test ./internal/psm/... -run TestScheduler -timeout 30s`
Expected: FAIL — `psm.NewScheduler`, `Start`, `Wait` existieren nicht.

- [ ] **Step 3: Scheduler implementieren**

```go
// apps/backend/internal/psm/scheduler.go
package psm

import (
    "context"
    "log"
    "sync"
    "time"
)

// Scheduler runs a background goroutine that triggers Sync at a fixed interval.
// It also performs one immediate sync at Start so the very first tick doesn't
// have to wait for the full interval.
type Scheduler struct {
    svc      *SyncService
    interval time.Duration
    done     chan struct{}
    wg       sync.WaitGroup
}

func NewScheduler(svc *SyncService, interval time.Duration) *Scheduler {
    return &Scheduler{svc: svc, interval: interval, done: make(chan struct{})}
}

// Start launches the background goroutine. Returns immediately. Cancelling
// the context stops the scheduler. Use Wait() to block until the goroutine
// has actually exited.
func (s *Scheduler) Start(ctx context.Context) {
    s.wg.Add(1)
    go func() {
        defer s.wg.Done()
        // Immediate first sync (best-effort; errors are logged inside SyncService).
        if err := s.svc.Sync(ctx); err != nil {
            log.Printf("psm scheduler initial sync: %v", err)
        }
        t := time.NewTicker(s.interval)
        defer t.Stop()
        for {
            select {
            case <-ctx.Done():
                return
            case <-t.C:
                if err := s.svc.Sync(ctx); err != nil {
                    log.Printf("psm scheduler periodic sync: %v", err)
                }
            }
        }
    }()
}

// Wait blocks until the scheduler goroutine has exited (after the context
// passed to Start was cancelled).
func (s *Scheduler) Wait() { s.wg.Wait() }
```

- [ ] **Step 4: Tests ausführen, PASS erwartet**

Run: `cd apps/backend && go test ./internal/psm/... -run TestScheduler -timeout 30s -v`
Expected: both tests pass.

- [ ] **Step 5: Scheduler in main.go anbinden**

In `apps/backend/main.go`, den existierenden Initial-Sync-Goroutine durch den Scheduler ersetzen:

```go
// Existing:
// go func() {
//     ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
//     defer cancel()
//     if err := psmSync.Sync(ctx); err != nil { log.Printf(...) }
// }()

// Replace with:
psmScheduler := psm.NewScheduler(psmSync, 7*24*time.Hour)
psmScheduler.Start(context.Background())
```

Der Scheduler macht selbst den Initial-Sync — kein separater Goroutine-Aufruf nötig.

- [ ] **Step 6: Build**

```
cd apps/backend && go build ./...
```

Expected: clean.

---

### Task 5: RiskResponse um PSM-Sync-Status erweitern

**Files:**
- Modify: `apps/backend/internal/protection/service.go`
- Modify: `apps/backend/internal/protection/service_test.go`

- [ ] **Step 1: Test schreiben**

In `service_test.go`, dem bestehenden `stubPSM` einen `Meta()` mit echtem Wert mitgeben. Erweitere `fakePSM` aus dem bestehenden Test:

```go
type fakePSMWithMeta struct {
    fakePSM
    meta *domain.PSMSyncMeta
}

func (f *fakePSMWithMeta) Meta() (*domain.PSMSyncMeta, error) { return f.meta, nil }
```

Neuer Test:

```go
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
    psm := &fakePSMWithMeta{meta: &domain.PSMSyncMeta{LastSyncAt: staleAt, Status: "ok"}}
    svc := protection.NewRiskService(vys, agro, &fakeSpray{}, psm, &fakePeriods{}, agrometeo.NewCache())
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
    psm := &fakePSMWithMeta{meta: &domain.PSMSyncMeta{LastSyncAt: time.Now().Add(-5 * 24 * time.Hour), Status: "ok"}}
    svc := protection.NewRiskService(vys, agro, &fakeSpray{}, psm, &fakePeriods{}, agrometeo.NewCache())
    res, err := svc.Compute(context.Background(), vy.ID)
    require.NoError(t, err)
    assert.False(t, res.PSMSyncStale)
}
```

- [ ] **Step 2: Test laufen lassen, FAIL erwartet**

Run: `cd apps/backend && go test ./internal/protection/... -run "TestService_Compute_PSM" -timeout 30s`
Expected: FAIL — `RiskResponse.PSMSyncStale`, `PSMSyncAt` existieren nicht.

- [ ] **Step 3: RiskResponse erweitern**

In `apps/backend/internal/protection/service.go`:

```go
type RiskResponse struct {
    VineyardID   uuid.UUID       `json:"vineyardId"`
    StationID    int             `json:"stationId"`
    StationName  string          `json:"stationName"`
    FetchedAt    time.Time       `json:"fetchedAt"`
    Phenology    *PhenologyInfo  `json:"phenology,omitempty"`
    Diseases     []DiseaseResult `json:"diseases"`
    PSMSyncStale bool            `json:"psmSyncStale,omitempty"`
    PSMSyncAt    *time.Time      `json:"psmSyncAt,omitempty"`
}

const psmStaleThreshold = 60 * 24 * time.Hour
```

Und in `Compute` am Ende, nach `sortBySeverity(out.Diseases)`:

```go
if meta, err := s.psm.Meta(); err == nil && meta != nil {
    syncAt := meta.LastSyncAt
    out.PSMSyncAt = &syncAt
    if time.Since(meta.LastSyncAt) > psmStaleThreshold {
        out.PSMSyncStale = true
    }
}
```

- [ ] **Step 4: Test laufen lassen, PASS erwartet**

Run: `cd apps/backend && go test ./internal/protection/... -timeout 30s -v`
Expected: alle Tests (alte + neu 2) PASS.

---

### Task 6: Frontend-Typen erweitern

**Files:**
- Modify: `apps/frontend/src/types/index.ts`

- [ ] **Step 1: DiseaseRiskResponse erweitern**

Im bestehenden `DiseaseRiskResponse` Interface (`apps/frontend/src/types/index.ts`) zwei optionale Felder ergänzen:

```ts
export interface DiseaseRiskResponse {
  vineyardId: string
  stationId: number
  stationName: string
  fetchedAt: string
  phenology?: { rawIndex: number; label: string }
  diseases: DiseaseResult[]
  psmSyncStale?: boolean
  psmSyncAt?: string
}
```

- [ ] **Step 2: Lint**

```
cd apps/frontend && pnpm lint
```

Expected: clean.

---

### Task 7: DiseaseCard-Komponente

**Files:**
- Create: `apps/frontend/src/components/Vineyard/DiseaseCard.tsx`
- Create: `apps/frontend/src/components/Vineyard/DiseaseCard.test.tsx`

- [ ] **Step 1: DiseaseCard.tsx schreiben**

```tsx
// apps/frontend/src/components/Vineyard/DiseaseCard.tsx
import { Box, Card, CardContent, Chip, Tooltip, Typography } from '@mui/material'
import type { DiseaseResult } from '../../types'

interface Props {
  disease: DiseaseResult
}

const LEVEL_CHIP_COLOR = { grün: 'success', gelb: 'warning', rot: 'error' } as const
const LEVEL_ICON: Record<string, string> = { grün: '🟢', gelb: '🟡', rot: '🔴' }

const MEASURE_LABEL: Record<string, string> = {
  spray: 'Spritzung',
  dispenser: 'Dispenser',
  'mowing-pause': 'Mahd-Pause',
}

export default function DiseaseCard({ disease }: Props) {
  const effective = disease.effectiveLevel || 'grün'
  const chipColor = LEVEL_CHIP_COLOR[effective as keyof typeof LEVEL_CHIP_COLOR] ?? 'default'
  const icon = LEVEL_ICON[effective] ?? '⚪'
  const isModified = disease.rawLevel !== disease.effectiveLevel

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 }, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
          {disease.name}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={`${icon} ${effective}`}
            size="small"
            color={chipColor}
            sx={{ fontWeight: 500 }}
          />
          {isModified && (
            <Tooltip title={`Modellrisiko: ${disease.rawLevel} (Index ${disease.rawIndex.toFixed(0)})`} arrow>
              <Chip
                label={`Modell: ${LEVEL_ICON[disease.rawLevel] ?? '⚪'}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            </Tooltip>
          )}
        </Box>
        {disease.measureType && (
          <Typography variant="caption" color="text.secondary">
            {MEASURE_LABEL[disease.measureType] ?? disease.measureType}
            {disease.lastMeasureAt &&
              ` · seit ${new Date(disease.lastMeasureAt).toLocaleDateString('de-CH')}`}
          </Typography>
        )}
        {disease.recommendation && (
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.25, lineHeight: 1.35 }}>
            {disease.recommendation}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: DiseaseCard.test.tsx schreiben**

```tsx
// apps/frontend/src/components/Vineyard/DiseaseCard.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import DiseaseCard from './DiseaseCard'
import type { DiseaseResult } from '../../types'

function makeDisease(overrides: Partial<DiseaseResult> = {}): DiseaseResult {
  return {
    key: 'mildiou',
    name: 'Falscher Mehltau',
    modelId: 7,
    rawIndex: 0,
    rawLevel: 'grün',
    effectiveIndex: 0,
    effectiveLevel: 'grün',
    ...overrides,
  }
}

describe('DiseaseCard', () => {
  it('renders the disease name and effective level', () => {
    render(<DiseaseCard disease={makeDisease({ effectiveLevel: 'rot' })} />)
    expect(screen.getByText('Falscher Mehltau')).toBeInTheDocument()
    expect(screen.getByText(/rot/i)).toBeInTheDocument()
  })

  it('shows the raw-level hint when effective differs from raw', () => {
    render(<DiseaseCard disease={makeDisease({
      rawLevel: 'rot', rawIndex: 226, effectiveLevel: 'grün',
      measureType: 'dispenser', lastMeasureAt: '2026-03-15T08:00:00Z',
    })} />)
    expect(screen.getByText(/Modell/)).toBeInTheDocument()
    expect(screen.getByText(/Dispenser/)).toBeInTheDocument()
  })

  it('renders the recommendation when present', () => {
    render(<DiseaseCard disease={makeDisease({
      effectiveLevel: 'rot', recommendation: 'Spritzung dringend empfohlen',
    })} />)
    expect(screen.getByText('Spritzung dringend empfohlen')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Test laufen lassen**

```
cd apps/frontend && pnpm test DiseaseCard -- --run
```

Expected: 3 tests pass.

---

### Task 8: ProtectionPanel-Komponente

**Files:**
- Create: `apps/frontend/src/components/Vineyard/ProtectionPanel.tsx`
- Create: `apps/frontend/src/components/Vineyard/ProtectionPanel.test.tsx`

- [ ] **Step 1: ProtectionPanel.tsx schreiben**

```tsx
// apps/frontend/src/components/Vineyard/ProtectionPanel.tsx
import { useEffect, useState } from 'react'
import { Alert, Box, Grid, Skeleton, Typography } from '@mui/material'
import type { DiseaseRiskResponse } from '../../types'
import { getDiseaseRisk } from '../../api/protection'
import DiseaseCard from './DiseaseCard'

interface Props {
  vineyardId: string
}

export default function ProtectionPanel({ vineyardId }: Props) {
  const [data, setData] = useState<DiseaseRiskResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    getDiseaseRisk(vineyardId)
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [vineyardId])

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={240} />
        <Box sx={{ mt: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={120} />
          ))}
        </Box>
      </Box>
    )
  }

  if (error || !data) {
    return <Alert severity="warning">Pflanzenschutz-Daten nicht verfügbar.</Alert>
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
        <Typography variant="overline" color="text.secondary">
          Pflanzenschutz
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Station {data.stationName}
        </Typography>
        {data.phenology && (
          <Typography variant="caption" color="text.secondary">
            · {data.phenology.label}
          </Typography>
        )}
      </Box>

      <Grid container spacing={1.5}>
        {data.diseases.map((d) => (
          <Grid key={d.key} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <DiseaseCard disease={d} />
          </Grid>
        ))}
      </Grid>

      {data.psmSyncStale && (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          PSM-Datenstand älter als 60 Tage
          {data.psmSyncAt && ` (zuletzt aktualisiert ${new Date(data.psmSyncAt).toLocaleDateString('de-CH')})`}.
        </Alert>
      )}
    </Box>
  )
}
```

- [ ] **Step 2: ProtectionPanel.test.tsx schreiben**

```tsx
// apps/frontend/src/components/Vineyard/ProtectionPanel.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProtectionPanel from './ProtectionPanel'
import * as protectionApi from '../../api/protection'

vi.mock('../../api/protection')

describe('ProtectionPanel', () => {
  beforeEach(() => vi.resetAllMocks())

  it('renders one card per disease with header info', async () => {
    vi.mocked(protectionApi.getDiseaseRisk).mockResolvedValue({
      vineyardId: 'v1',
      stationId: 138,
      stationName: 'SARGANS',
      fetchedAt: '2026-05-13T12:00:00Z',
      phenology: { rawIndex: 65, label: 'BBCH 60-69 Blüte' },
      diseases: [
        { key: 'mildiou', name: 'Falscher Mehltau', modelId: 7, rawIndex: 226, rawLevel: 'rot', effectiveIndex: 226, effectiveLevel: 'rot' },
        { key: 'oidium', name: 'Echter Mehltau', modelId: 8, rawIndex: 0, rawLevel: 'grün', effectiveIndex: 0, effectiveLevel: 'grün' },
      ],
    })

    render(<ProtectionPanel vineyardId="v1" />)
    await waitFor(() => expect(screen.getByText('Station SARGANS')).toBeInTheDocument())
    expect(screen.getByText(/BBCH 60-69/)).toBeInTheDocument()
    expect(screen.getByText('Falscher Mehltau')).toBeInTheDocument()
    expect(screen.getByText('Echter Mehltau')).toBeInTheDocument()
  })

  it('shows the stale-data alert when psmSyncStale is true', async () => {
    vi.mocked(protectionApi.getDiseaseRisk).mockResolvedValue({
      vineyardId: 'v1',
      stationId: 138,
      stationName: 'SARGANS',
      fetchedAt: '2026-05-13T12:00:00Z',
      diseases: [],
      psmSyncStale: true,
      psmSyncAt: '2026-02-01T00:00:00Z',
    })

    render(<ProtectionPanel vineyardId="v1" />)
    await waitFor(() => expect(screen.getByText(/Datenstand älter als 60 Tage/)).toBeInTheDocument())
  })

  it('shows an alert when the API call fails', async () => {
    vi.mocked(protectionApi.getDiseaseRisk).mockRejectedValue(new Error('boom'))
    render(<ProtectionPanel vineyardId="v1" />)
    await waitFor(() => expect(screen.getByText(/nicht verfügbar/)).toBeInTheDocument())
  })
})
```

- [ ] **Step 3: Test laufen lassen**

```
cd apps/frontend && pnpm test ProtectionPanel -- --run
```

Expected: 3 tests pass.

---

### Task 9: VineyardDetail-Page umstellen

**Files:**
- Modify: `apps/frontend/src/components/Vineyard/VineyardDetail.tsx`

- [ ] **Step 1: ProtectionBadge → ProtectionPanel**

Im File `apps/frontend/src/components/Vineyard/VineyardDetail.tsx`:

a. Import austauschen:

```tsx
// Vorher:
import ProtectionBadge from './ProtectionBadge'

// Nachher:
import ProtectionPanel from './ProtectionPanel'
```

b. JSX-Aufruf austauschen:

```tsx
// Vorher:
<Box sx={{ mt: 1.5 }}>
  <ProtectionBadge vineyardId={vineyard.id} />
</Box>

// Nachher:
<Box sx={{ mt: 1.5 }}>
  <ProtectionPanel vineyardId={vineyard.id} />
</Box>
```

`ProtectionBadge` bleibt im Repo erhalten — wird weiterhin in der Vineyard-Liste / Karten-Übersicht verwendet (`ProtectionBadge`-Aufrufe ausserhalb von `VineyardDetail.tsx` nicht anfassen).

- [ ] **Step 2: Lint und Tests**

```
cd apps/frontend && pnpm lint
cd apps/frontend && pnpm test -- --run
```

Expected: clean lint, alle Tests pass (≥ 34 mit den neuen DiseaseCard- und ProtectionPanel-Tests).

- [ ] **Step 3: Build prüfen**

```
cd apps/frontend && pnpm build
```

Expected: erfolgreicher Build.

---

## Self-Review

**Spec-Coverage:**
- Auto-Anlage/-Schliessung von protection_periods → Tasks 1-3
- Combinator-Logik für Dispenser/Mahd-Pause → bereits in Stufe 1
- Cron-Job für PSM-Sync → Task 4
- Stale-Detection → Tasks 5, 8 (Banner)
- Pflanzenschutz-Panel mit PhenologyHeader + DiseaseGrid + DiseaseCard → Tasks 7, 8
- TaskForm-Subtypen für Dispenser/Mahd-Pause → bereits in Stufe 1

**Bewusst NICHT in Stufe 2:**
- Detail-Modal beim Klick auf Kachel (kommt in Stufe 3)
- Trend- und Forecast-Charts (Stufe 3)
- Massnahmen-Timeline (Stufe 3)
- Admin-Endpoint `POST /api/admin/psm-sync` — der Scheduler deckt die Aktualität ab; manuelles Triggern wäre nur Ops-Komfort

**Placeholder/Konsistenz:**
- Keine TBD/TODO/FIXME im Plan
- Method-Signaturen konsistent: `OnTaskCreated(*domain.Task) error`, `NewScheduler(svc, interval)`, `Start(ctx)`, `Wait()`
- Frontend nutzt MUI Grid v2 (`size={{xs:12...}}`) — bereits projektweit etabliert
- DiseaseCard erwartet `DiseaseResult` 1:1 aus `getDiseaseRisk` (kein Mapping nötig)

**Risiken:**
- Scheduler tickt alle 7 Tage; bei sehr lange laufendem Backend (>30 Tage ohne Restart) verlässt sich der Initial-Sync-Skip auf `psm_sync_meta` — schon in Stufe 1 implementiert. OK.
- PeriodWriter ignoriert `dispenser-entfernen`, wenn keine offene Periode existiert — `CloseLatest` macht dann ein UPDATE auf 0 Zeilen (still OK). Beabsichtigt, da Idempotenz wichtiger ist als ein Fehler bei "doppeltem Schliessen".

---

**Nächster Schritt:** User-Review oder direkt subagent-driven-development.
