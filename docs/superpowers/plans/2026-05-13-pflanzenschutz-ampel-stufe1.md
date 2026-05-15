# Pflanzenschutz-Ampel — Stufe 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Foundation für die modellbasierte Pflanzenschutz-Ampel: BLV-PSM-Datenimport, erweiterte Agrometeo-Anbindung, neuer `/disease-risk`-Endpoint und Spritz-Erfassung mit Wirkstoff/Produkt-Auswahl.

**Architecture:** Neue Backend-Pakete `internal/psm` (XML-Sync) und `internal/protection` (Disease-Risk-Service). `internal/agrometeo` wird erweitert um Modell-Geojson-Fetch. Datenmodell wird um `psm_*`-Tabellen, `tasks.subtype`, `spray_applications`, `protection_periods` ergänzt. Frontend bekommt Subtype-Auswahl + Produkt-Picker in `TaskForm`; `ProtectionBadge` zeigt Worst-Of aus neuem Endpoint.

**Tech Stack:** Go 1.26 (chi v5, GORM, encoding/xml, testcontainers), PostgreSQL 16 (PostGIS), React 18 (TypeScript, MUI, Vitest, MSW). Bezug: `docs/superpowers/specs/2026-05-13-pflanzenschutz-ampel-design.md`.

---

## File Structure

**Backend — Neue Dateien:**

| Datei | Verantwortung |
|---|---|
| `apps/backend/migrations/014_psm_data.sql` | Tabellen `psm_substances`, `psm_pests`, `psm_products`, `psm_product_substances`, `psm_indications`, `psm_sync_meta` |
| `apps/backend/migrations/015_task_subtype_spray.sql` | `tasks.subtype` + `spray_applications` |
| `apps/backend/migrations/016_protection_periods.sql` | `protection_periods` |
| `apps/backend/internal/domain/psm.go` | PSM-Domänen-Typen + Repository-Interfaces |
| `apps/backend/internal/domain/protection.go` | Spray/ProtectionPeriod-Typen + Interfaces |
| `apps/backend/internal/store/psm.go` | PSM-Tabellen-Operationen (Upsert + Search) |
| `apps/backend/internal/store/psm_test.go` | Integration-Tests gegen testcontainers |
| `apps/backend/internal/store/spray.go` | `spray_applications`-CRUD |
| `apps/backend/internal/store/protection_period.go` | `protection_periods`-CRUD |
| `apps/backend/internal/store/spray_test.go` | Integration-Test |
| `apps/backend/internal/psm/xml.go` | XML-Streaming-Parser (encoding/xml.Decoder) |
| `apps/backend/internal/psm/xml_test.go` | Tests mit synthetischer XML-Fixture |
| `apps/backend/internal/psm/testdata/sample.xml` | Synthetische Fixture mit 2 Produkten, 3 Wirkstoffen, 1 Schaderreger |
| `apps/backend/internal/psm/sync.go` | `Service.Sync(ctx)` — Download + Parse + Upsert |
| `apps/backend/internal/psm/sync_test.go` | Test mit httptest-Server, ZIP-Stream |
| `apps/backend/internal/protection/config.go` | `Diseases`, Skala-Schwellen, Pest-Mapping (Konstanten) |
| `apps/backend/internal/protection/combinator.go` | Pure-Function `Combine(raw, measure) → effective` |
| `apps/backend/internal/protection/combinator_test.go` | Table-driven Tests |
| `apps/backend/internal/protection/service.go` | `RiskService.Compute(vineyardID)` |
| `apps/backend/internal/protection/service_test.go` | Integration-Test mit Mocks |
| `apps/backend/internal/handler/disease.go` | Handler `DiseaseRisk` |
| `apps/backend/internal/handler/disease_test.go` | Handler-Integration-Test |
| `apps/backend/internal/handler/psm.go` | Handler für `/api/psm/products` und `/api/psm/substances` |
| `apps/backend/internal/handler/psm_test.go` | Handler-Test |

**Backend — Modifikationen:**

| Datei | Änderung |
|---|---|
| `apps/backend/internal/agrometeo/client.go` | Methode `FetchModelGeojson(ctx, modelID, date) → []ModelFeature` und `FetchModelLegend` |
| `apps/backend/internal/agrometeo/cache.go` | Cache-Map für Model-Geojson keyed by `(modelID, date)` |
| `apps/backend/internal/domain/model.go` | Erweiterung `Task.Subtype *string`; `TaskCreateParams` um `Subtype` und `Spray` |
| `apps/backend/internal/store/task.go` | `Create` schreibt `subtype` und persistiert ggf. `spray_applications` |
| `apps/backend/internal/handler/task.go` | Decoding für `subtype` + `spray` Subfeld |
| `apps/backend/main.go` | PSM-Sync-Service initialisieren, Routes für `/disease-risk` und `/api/psm/*` wiren, Initial-Sync triggern |
| `apps/backend/migrations/migrations_test.go` | Neue Tabellen im Existenz-Check aufnehmen |

**Frontend — Neue Dateien:**

| Datei | Verantwortung |
|---|---|
| `apps/frontend/src/api/protection.ts` | `getDiseaseRisk(vineyardId)` |
| `apps/frontend/src/api/psm.ts` | `searchProducts(q)`, `getProduct(id)`, `searchSubstances(q)` |
| `apps/frontend/src/components/Tasks/SprayFields.tsx` | Produkt-Autocomplete + abgeleitete Wirkstoff/Target-Anzeige |
| `apps/frontend/src/components/Tasks/SprayFields.test.tsx` | Vitest |

**Frontend — Modifikationen:**

| Datei | Änderung |
|---|---|
| `apps/frontend/src/types/index.ts` | Neue Typen: `DiseaseRisk`, `DiseaseRiskResponse`, `PsmProduct`, `PsmSubstance`, `TaskSubtype`, `SprayPayload` |
| `apps/frontend/src/components/Tasks/TaskForm.tsx` | Subtype-Auswahl bei `category='pflanzenschutz'`; `SprayFields` einblenden bei `subtype='spritzung'` |
| `apps/frontend/src/components/Vineyard/ProtectionBadge.tsx` | Datenquelle `getDiseaseRisk` statt `getProtectionStatus`; zeigt Worst-Of |
| `apps/frontend/src/api/weather.ts` | `getProtectionStatus` behält Signatur, ruft intern `getDiseaseRisk` und reduziert auf Worst-Of-`PlantProtectionStatus` |

---

### Task 1: Datenbank-Migrationen

**Files:**
- Create: `apps/backend/migrations/014_psm_data.sql`
- Create: `apps/backend/migrations/015_task_subtype_spray.sql`
- Create: `apps/backend/migrations/016_protection_periods.sql`
- Modify: `apps/backend/migrations/migrations_test.go:14-18` (Tabellen-Check erweitern)

- [ ] **Step 1: 014_psm_data.sql schreiben**

```sql
-- apps/backend/migrations/014_psm_data.sql
CREATE TABLE IF NOT EXISTS psm_substances (
    id          UUID         PRIMARY KEY,
    name_de     TEXT         NOT NULL,
    name_fr     TEXT,
    name_it     TEXT,
    synced_at   TIMESTAMPTZ  NOT NULL
);

CREATE TABLE IF NOT EXISTS psm_pests (
    id          UUID         PRIMARY KEY,
    name_de     TEXT         NOT NULL,
    name_fr     TEXT,
    name_it     TEXT,
    synced_at   TIMESTAMPTZ  NOT NULL
);

CREATE TABLE IF NOT EXISTS psm_products (
    id                    TEXT         PRIMARY KEY,
    w_nbr                 TEXT         NOT NULL,
    name                  TEXT         NOT NULL,
    permission_holder_id  UUID,
    exhaustion_deadline   DATE,
    soldout_deadline      DATE,
    termination_reason    TEXT,
    is_parallel_import    BOOLEAN      NOT NULL DEFAULT FALSE,
    synced_at             TIMESTAMPTZ  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_psm_products_name_trgm
    ON psm_products USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS psm_product_substances (
    product_id          TEXT     NOT NULL REFERENCES psm_products(id) ON DELETE CASCADE,
    substance_id        UUID     NOT NULL REFERENCES psm_substances(id),
    in_percent          NUMERIC(8,4),
    in_gramm_per_litre  NUMERIC(10,4),
    PRIMARY KEY (product_id, substance_id)
);

CREATE TABLE IF NOT EXISTS psm_indications (
    id                    BIGSERIAL    PRIMARY KEY,
    product_id            TEXT         NOT NULL REFERENCES psm_products(id) ON DELETE CASCADE,
    pest_id               UUID         NOT NULL REFERENCES psm_pests(id),
    culture_id            UUID         NOT NULL,
    dosage_from           NUMERIC(10,4),
    dosage_to             NUMERIC(10,4),
    dosage_unit           TEXT,
    waiting_period_days   INTEGER,
    application_area      TEXT,
    expenditure_form      TEXT
);

CREATE INDEX IF NOT EXISTS idx_psm_indications_pest    ON psm_indications(pest_id);
CREATE INDEX IF NOT EXISTS idx_psm_indications_product ON psm_indications(product_id);

CREATE TABLE IF NOT EXISTS psm_sync_meta (
    id                       INT         PRIMARY KEY DEFAULT 1,
    last_sync_at             TIMESTAMPTZ NOT NULL,
    source_publication_date  DATE,
    product_count            INT,
    status                   TEXT,
    error_message            TEXT,
    CHECK (id = 1)
);

-- pg_trgm wird für Produkt-Autocomplete benötigt
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

- [ ] **Step 2: 015_task_subtype_spray.sql schreiben**

```sql
-- apps/backend/migrations/015_task_subtype_spray.sql
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS subtype TEXT;

ALTER TABLE tasks
    ADD CONSTRAINT tasks_subtype_requires_pflanzenschutz
    CHECK (subtype IS NULL OR category = 'pflanzenschutz');

CREATE TABLE IF NOT EXISTS spray_applications (
    task_id          UUID          PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
    product_id       TEXT          REFERENCES psm_products(id),
    substance_ids    UUID[]        NOT NULL,
    target_pest_ids  UUID[],
    dosage           NUMERIC(10,4),
    dosage_unit      TEXT,
    applied_at       TIMESTAMPTZ   NOT NULL,
    notes            TEXT
);

CREATE INDEX IF NOT EXISTS idx_spray_applications_applied
    ON spray_applications (applied_at DESC);
```

- [ ] **Step 3: 016_protection_periods.sql schreiben**

```sql
-- apps/backend/migrations/016_protection_periods.sql
CREATE TABLE IF NOT EXISTS protection_periods (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    vineyard_id       UUID         NOT NULL REFERENCES vineyards(id) ON DELETE CASCADE,
    kind              TEXT         NOT NULL CHECK (kind IN ('dispenser', 'mowing-pause')),
    start_task_id     UUID         NOT NULL REFERENCES tasks(id),
    end_task_id       UUID         REFERENCES tasks(id),
    start_at          TIMESTAMPTZ  NOT NULL,
    end_at            TIMESTAMPTZ,
    target_pest_ids   UUID[]       NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_protection_periods_vineyard
    ON protection_periods (vineyard_id);

CREATE INDEX IF NOT EXISTS idx_protection_periods_active
    ON protection_periods (vineyard_id, kind) WHERE end_at IS NULL;
```

- [ ] **Step 4: migrations_test.go erweitern**

Im File `apps/backend/migrations/migrations_test.go`, Zeile ~15 die `tables`-Liste ersetzen:

```go
tables := []string{
    "users", "vineyards", "rows", "vines", "tasks", "task_photos",
    "psm_substances", "psm_pests", "psm_products",
    "psm_product_substances", "psm_indications", "psm_sync_meta",
    "spray_applications", "protection_periods",
}
```

- [ ] **Step 5: Migrations laufen lassen**

Run: `cd apps/backend && go test ./migrations/... -timeout 120s -run TestMigrations`
Expected: PASS (alle Tabellen vorhanden, PostGIS+pg_trgm-Extensions geladen).

---

### Task 2: PSM-Domänen-Typen und Store

**Files:**
- Create: `apps/backend/internal/domain/psm.go`
- Create: `apps/backend/internal/store/psm.go`
- Create: `apps/backend/internal/store/psm_test.go`

- [ ] **Step 1: Domain-Typen definieren**

```go
// apps/backend/internal/domain/psm.go
package domain

import (
    "time"
    "github.com/google/uuid"
)

type PSMSubstance struct {
    ID      uuid.UUID `json:"id"`
    NameDE  string    `json:"nameDe"`
    NameFR  *string   `json:"nameFr,omitempty"`
    NameIT  *string   `json:"nameIt,omitempty"`
}

type PSMPest struct {
    ID      uuid.UUID `json:"id"`
    NameDE  string    `json:"nameDe"`
    NameFR  *string   `json:"nameFr,omitempty"`
    NameIT  *string   `json:"nameIt,omitempty"`
}

type PSMProduct struct {
    ID                 string       `json:"id"`
    WNbr               string       `json:"wNbr"`
    Name               string       `json:"name"`
    IsParallelImport   bool         `json:"isParallelImport"`
    ExhaustionDeadline *time.Time   `json:"exhaustionDeadline,omitempty"`
    SoldoutDeadline    *time.Time   `json:"soldoutDeadline,omitempty"`
    Substances         []PSMSubstance `json:"substances,omitempty"`
    Indications        []PSMIndication `json:"indications,omitempty"`
}

type PSMIndication struct {
    ID                 int64      `json:"id"`
    ProductID          string     `json:"productId"`
    PestID             uuid.UUID  `json:"pestId"`
    PestName           string     `json:"pestName,omitempty"`
    DosageFrom         *float64   `json:"dosageFrom,omitempty"`
    DosageTo           *float64   `json:"dosageTo,omitempty"`
    DosageUnit         string     `json:"dosageUnit,omitempty"`
    WaitingPeriodDays  *int       `json:"waitingPeriodDays,omitempty"`
    ApplicationArea    string     `json:"applicationArea,omitempty"`
}

type PSMSyncMeta struct {
    LastSyncAt              time.Time  `json:"lastSyncAt"`
    SourcePublicationDate   *time.Time `json:"sourcePublicationDate,omitempty"`
    ProductCount            int        `json:"productCount"`
    Status                  string     `json:"status"`
    ErrorMessage            string     `json:"errorMessage,omitempty"`
}

// PSMRepository ist die Persistenz-Abstraktion.
type PSMRepository interface {
    SearchProducts(q string, limit int) ([]PSMProduct, error)
    GetProduct(id string) (*PSMProduct, error)
    SearchSubstances(q string, limit int) ([]PSMSubstance, error)
    GetPestsForSubstances(substanceIDs []uuid.UUID) ([]uuid.UUID, error)
    UpsertBatch(b PSMBatch) error
    Meta() (*PSMSyncMeta, error)
    SetMeta(m PSMSyncMeta) error
}

// PSMBatch ist das, was der Sync-Service in einer Transaktion einspielt.
type PSMBatch struct {
    Substances  []PSMSubstance
    Pests       []PSMPest
    Products    []PSMProduct
    ProductSubstances []PSMProductSubstance
    Indications []PSMIndication
    SyncedAt    time.Time
}

type PSMProductSubstance struct {
    ProductID         string
    SubstanceID       uuid.UUID
    InPercent         *float64
    InGrammPerLitre   *float64
}
```

- [ ] **Step 2: Failing Tests schreiben**

```go
// apps/backend/internal/store/psm_test.go
package store_test

import (
    "testing"
    "time"

    "github.com/google/uuid"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    "wingert/backend/internal/domain"
    "wingert/backend/internal/store"
    "wingert/backend/internal/testutil"
)

func newPSMStore(t *testing.T) (*store.PSMStore, func()) {
    db, cleanup := testutil.NewPostgresContainer(t)
    testutil.RunMigrations(t, db)
    return store.NewPSMStore(db), cleanup
}

func sampleBatch() domain.PSMBatch {
    sid := uuid.MustParse("683783d6-0b1f-43d4-bf12-209fd6e3c693")
    pid := uuid.MustParse("0251feea-4e71-4881-8b0a-09874f39277a")
    return domain.PSMBatch{
        SyncedAt:          time.Now(),
        Substances:        []domain.PSMSubstance{{ID: sid, NameDE: "Folpet"}},
        Pests:             []domain.PSMPest{{ID: pid, NameDE: "Falscher Mehltau der Rebe"}},
        Products:          []domain.PSMProduct{{ID: "4090", WNbr: "W-4090", Name: "Aktuan"}},
        ProductSubstances: []domain.PSMProductSubstance{{ProductID: "4090", SubstanceID: sid}},
        Indications:       []domain.PSMIndication{{ProductID: "4090", PestID: pid}},
    }
}

func TestPSMStore_UpsertAndSearch(t *testing.T) {
    s, cleanup := newPSMStore(t)
    defer cleanup()

    b := sampleBatch()
    require.NoError(t, s.UpsertBatch(b))

    results, err := s.SearchProducts("Aktu", 10)
    require.NoError(t, err)
    require.Len(t, results, 1)
    assert.Equal(t, "Aktuan", results[0].Name)

    prod, err := s.GetProduct("4090")
    require.NoError(t, err)
    require.NotNil(t, prod)
    require.Len(t, prod.Substances, 1)
    assert.Equal(t, "Folpet", prod.Substances[0].NameDE)
    require.Len(t, prod.Indications, 1)
}

func TestPSMStore_GetPestsForSubstances(t *testing.T) {
    s, cleanup := newPSMStore(t)
    defer cleanup()

    require.NoError(t, s.UpsertBatch(sampleBatch()))

    sid := uuid.MustParse("683783d6-0b1f-43d4-bf12-209fd6e3c693")
    pests, err := s.GetPestsForSubstances([]uuid.UUID{sid})
    require.NoError(t, err)
    require.Len(t, pests, 1)
}
```

Die `culture_id` wird vom Store automatisch auf die Reben-Konstante gesetzt (siehe Implementation in Step 4). Der Test braucht sie deshalb nicht im Batch zu übergeben.

- [ ] **Step 3: Test ausführen, FAIL erwartet**

Run: `cd apps/backend && go test ./internal/store/... -run TestPSMStore -timeout 120s`
Expected: FAIL — Symbole `store.PSMStore`, `store.NewPSMStore` existieren noch nicht.

- [ ] **Step 4: Store implementieren**

```go
// apps/backend/internal/store/psm.go
package store

import (
    "errors"

    "github.com/google/uuid"
    "github.com/lib/pq"
    "gorm.io/gorm"
    "wingert/backend/internal/domain"
)

const rebenCultureID = "2314eb9f-7207-409f-a0d4-89b6a1177363"

type PSMStore struct{ db *gorm.DB }

func NewPSMStore(db *gorm.DB) *PSMStore { return &PSMStore{db: db} }

func (s *PSMStore) UpsertBatch(b domain.PSMBatch) error {
    return s.db.Transaction(func(tx *gorm.DB) error {
        for _, sub := range b.Substances {
            if err := tx.Exec(`
                INSERT INTO psm_substances (id, name_de, name_fr, name_it, synced_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (id) DO UPDATE SET
                    name_de   = EXCLUDED.name_de,
                    name_fr   = EXCLUDED.name_fr,
                    name_it   = EXCLUDED.name_it,
                    synced_at = EXCLUDED.synced_at`,
                sub.ID, sub.NameDE, sub.NameFR, sub.NameIT, b.SyncedAt).Error; err != nil {
                return err
            }
        }
        for _, p := range b.Pests {
            if err := tx.Exec(`
                INSERT INTO psm_pests (id, name_de, name_fr, name_it, synced_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (id) DO UPDATE SET
                    name_de=EXCLUDED.name_de, name_fr=EXCLUDED.name_fr,
                    name_it=EXCLUDED.name_it, synced_at=EXCLUDED.synced_at`,
                p.ID, p.NameDE, p.NameFR, p.NameIT, b.SyncedAt).Error; err != nil {
                return err
            }
        }
        for _, p := range b.Products {
            if err := tx.Exec(`
                INSERT INTO psm_products (id, w_nbr, name, is_parallel_import,
                    exhaustion_deadline, soldout_deadline, synced_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (id) DO UPDATE SET
                    w_nbr=EXCLUDED.w_nbr, name=EXCLUDED.name,
                    is_parallel_import=EXCLUDED.is_parallel_import,
                    exhaustion_deadline=EXCLUDED.exhaustion_deadline,
                    soldout_deadline=EXCLUDED.soldout_deadline,
                    synced_at=EXCLUDED.synced_at`,
                p.ID, p.WNbr, p.Name, p.IsParallelImport,
                p.ExhaustionDeadline, p.SoldoutDeadline, b.SyncedAt).Error; err != nil {
                return err
            }
            if err := tx.Exec(`DELETE FROM psm_product_substances WHERE product_id = ?`, p.ID).Error; err != nil {
                return err
            }
            if err := tx.Exec(`DELETE FROM psm_indications WHERE product_id = ?`, p.ID).Error; err != nil {
                return err
            }
        }
        for _, ps := range b.ProductSubstances {
            if err := tx.Exec(`
                INSERT INTO psm_product_substances (product_id, substance_id, in_percent, in_gramm_per_litre)
                VALUES (?, ?, ?, ?)`,
                ps.ProductID, ps.SubstanceID, ps.InPercent, ps.InGrammPerLitre).Error; err != nil {
                return err
            }
        }
        for _, ind := range b.Indications {
            if err := tx.Exec(`
                INSERT INTO psm_indications (product_id, pest_id, culture_id,
                    dosage_from, dosage_to, dosage_unit, waiting_period_days,
                    application_area, expenditure_form)
                VALUES (?, ?, ?::uuid, ?, ?, ?, ?, ?, ?)`,
                ind.ProductID, ind.PestID, rebenCultureID,
                ind.DosageFrom, ind.DosageTo, ind.DosageUnit, ind.WaitingPeriodDays,
                ind.ApplicationArea, "").Error; err != nil {
                return err
            }
        }
        return nil
    })
}

func (s *PSMStore) SearchProducts(q string, limit int) ([]domain.PSMProduct, error) {
    if limit <= 0 || limit > 50 {
        limit = 20
    }
    var rows []struct {
        ID    string
        WNbr  string `gorm:"column:w_nbr"`
        Name  string
    }
    pattern := "%" + q + "%"
    err := s.db.Raw(`
        SELECT id, w_nbr, name FROM psm_products
        WHERE name ILIKE ?
        ORDER BY similarity(name, ?) DESC, name ASC
        LIMIT ?`, pattern, q, limit).Scan(&rows).Error
    if err != nil {
        return nil, err
    }
    out := make([]domain.PSMProduct, len(rows))
    for i, r := range rows {
        out[i] = domain.PSMProduct{ID: r.ID, WNbr: r.WNbr, Name: r.Name}
    }
    return out, nil
}

func (s *PSMStore) GetProduct(id string) (*domain.PSMProduct, error) {
    var head struct {
        ID, WNbr, Name string
        IsParallelImport bool `gorm:"column:is_parallel_import"`
    }
    err := s.db.Raw(`
        SELECT id, w_nbr, name, is_parallel_import FROM psm_products WHERE id = ?`, id).Scan(&head).Error
    if err != nil {
        return nil, err
    }
    if head.ID == "" {
        return nil, nil
    }
    p := &domain.PSMProduct{ID: head.ID, WNbr: head.WNbr, Name: head.Name, IsParallelImport: head.IsParallelImport}

    var subs []struct {
        ID     uuid.UUID
        NameDE string `gorm:"column:name_de"`
    }
    if err := s.db.Raw(`
        SELECT s.id, s.name_de FROM psm_substances s
        JOIN psm_product_substances ps ON ps.substance_id = s.id
        WHERE ps.product_id = ?`, id).Scan(&subs).Error; err != nil {
        return nil, err
    }
    for _, s2 := range subs {
        p.Substances = append(p.Substances, domain.PSMSubstance{ID: s2.ID, NameDE: s2.NameDE})
    }

    var inds []struct {
        ID                int64
        PestID            uuid.UUID `gorm:"column:pest_id"`
        PestName          string    `gorm:"column:pest_name"`
        DosageFrom        *float64
        DosageTo          *float64
        DosageUnit        string
        WaitingPeriodDays *int `gorm:"column:waiting_period_days"`
    }
    if err := s.db.Raw(`
        SELECT i.id, i.pest_id, p.name_de AS pest_name, i.dosage_from, i.dosage_to,
               i.dosage_unit, i.waiting_period_days
        FROM psm_indications i
        JOIN psm_pests p ON p.id = i.pest_id
        WHERE i.product_id = ?`, id).Scan(&inds).Error; err != nil {
        return nil, err
    }
    for _, in := range inds {
        p.Indications = append(p.Indications, domain.PSMIndication{
            ID: in.ID, ProductID: id, PestID: in.PestID, PestName: in.PestName,
            DosageFrom: in.DosageFrom, DosageTo: in.DosageTo, DosageUnit: in.DosageUnit,
            WaitingPeriodDays: in.WaitingPeriodDays,
        })
    }
    return p, nil
}

func (s *PSMStore) SearchSubstances(q string, limit int) ([]domain.PSMSubstance, error) {
    if limit <= 0 || limit > 50 { limit = 20 }
    var rows []struct {
        ID     uuid.UUID
        NameDE string `gorm:"column:name_de"`
    }
    err := s.db.Raw(`
        SELECT id, name_de FROM psm_substances
        WHERE name_de ILIKE ?
        ORDER BY name_de ASC
        LIMIT ?`, "%"+q+"%", limit).Scan(&rows).Error
    if err != nil {
        return nil, err
    }
    out := make([]domain.PSMSubstance, len(rows))
    for i, r := range rows {
        out[i] = domain.PSMSubstance{ID: r.ID, NameDE: r.NameDE}
    }
    return out, nil
}

func (s *PSMStore) GetPestsForSubstances(substanceIDs []uuid.UUID) ([]uuid.UUID, error) {
    if len(substanceIDs) == 0 {
        return nil, nil
    }
    var ids []uuid.UUID
    err := s.db.Raw(`
        SELECT DISTINCT i.pest_id
        FROM psm_indications i
        JOIN psm_product_substances ps ON ps.product_id = i.product_id
        WHERE ps.substance_id = ANY(?)`,
        pq.Array(substanceIDs)).Scan(&ids).Error
    if err != nil {
        return nil, err
    }
    return ids, nil
}

func (s *PSMStore) Meta() (*domain.PSMSyncMeta, error) {
    var m domain.PSMSyncMeta
    err := s.db.Raw(`SELECT last_sync_at, source_publication_date, product_count, status, error_message
        FROM psm_sync_meta WHERE id = 1`).Scan(&m).Error
    if errors.Is(err, gorm.ErrRecordNotFound) || m.LastSyncAt.IsZero() {
        return nil, nil
    }
    return &m, err
}

func (s *PSMStore) SetMeta(m domain.PSMSyncMeta) error {
    return s.db.Exec(`
        INSERT INTO psm_sync_meta (id, last_sync_at, source_publication_date, product_count, status, error_message)
        VALUES (1, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
            last_sync_at=EXCLUDED.last_sync_at,
            source_publication_date=EXCLUDED.source_publication_date,
            product_count=EXCLUDED.product_count,
            status=EXCLUDED.status,
            error_message=EXCLUDED.error_message`,
        m.LastSyncAt, m.SourcePublicationDate, m.ProductCount, m.Status, m.ErrorMessage).Error
}
```

Dependency in `go.mod` für `github.com/lib/pq` (für `pq.Array`):

Run: `cd apps/backend && go get github.com/lib/pq && go mod tidy`

- [ ] **Step 5: Tests laufen lassen, PASS erwartet**

Run: `cd apps/backend && go test ./internal/store/... -run TestPSMStore -timeout 120s -v`
Expected: PASS für beide Tests.

---

### Task 3: PSM XML-Parser

**Files:**
- Create: `apps/backend/internal/psm/xml.go`
- Create: `apps/backend/internal/psm/testdata/sample.xml`
- Create: `apps/backend/internal/psm/xml_test.go`

- [ ] **Step 1: Fixture-XML schreiben**

```xml
<!-- apps/backend/internal/psm/testdata/sample.xml -->
<?xml version="1.0" encoding="utf-8"?>
<PublicationData>
  <Products>
    <Product id="4090" wNbr="W-4090" name="Aktuan" exhaustionDeadline="" soldoutDeadline="" isSalePermission="false" terminationReason="">
      <ProductInformation>
        <Ingredient inPercent="10">
          <SubstanceType SubstanceType="active"/>
          <Substance primaryKey="9d9a5c3d-1941-4fc3-9111-1fe4cd86e28b"/>
        </Ingredient>
        <Ingredient inPercent="25">
          <SubstanceType SubstanceType="active"/>
          <Substance primaryKey="63c58a64-ed05-473a-a71d-1b266552e710"/>
        </Ingredient>
        <Indication dosageFrom="0.125" dosageTo="0.125" waitingPeriod="56" expenditureForm="kg/ha" expenditureTo="2">
          <Measure primaryKey="m-spritzung"/>
          <Culture primaryKey="2314eb9f-7207-409f-a0d4-89b6a1177363" additionalTextPrimaryKey=""/>
          <Pest primaryKey="0251feea-4e71-4881-8b0a-09874f39277a" additionalTextPrimaryKey="" type="fungus"/>
        </Indication>
      </ProductInformation>
    </Product>
    <Product id="5500" wNbr="W-5500" name="NurApfel" exhaustionDeadline="" soldoutDeadline="" isSalePermission="false" terminationReason="">
      <ProductInformation>
        <Ingredient inPercent="40">
          <SubstanceType SubstanceType="active"/>
          <Substance primaryKey="00000000-0000-0000-0000-000000000001"/>
        </Ingredient>
        <Indication dosageFrom="0.1" dosageTo="0.1" waitingPeriod="21" expenditureForm="l/ha" expenditureTo="">
          <Measure primaryKey="m-spritzung"/>
          <Culture primaryKey="00000000-0000-0000-0000-000000000099" additionalTextPrimaryKey=""/>
          <Pest primaryKey="00000000-0000-0000-0000-000000000010" additionalTextPrimaryKey="" type="fungus"/>
        </Indication>
      </ProductInformation>
    </Product>
  </Products>
  <Parallelimports/>
  <MetaData>
    <Detail primaryKey="9d9a5c3d-1941-4fc3-9111-1fe4cd86e28b">
      <Description value="Cymoxanil" language="de"/>
      <Description value="Cymoxanil" language="fr"/>
    </Detail>
    <Detail primaryKey="63c58a64-ed05-473a-a71d-1b266552e710">
      <Description value="Dithianon" language="de"/>
    </Detail>
    <Detail primaryKey="00000000-0000-0000-0000-000000000001">
      <Description value="Other" language="de"/>
    </Detail>
  </MetaData>
  <MetaData>
    <Detail primaryKey="0251feea-4e71-4881-8b0a-09874f39277a">
      <Description value="Falscher Mehltau der Rebe" language="de"/>
    </Detail>
    <Detail primaryKey="00000000-0000-0000-0000-000000000010">
      <Description value="Apfelschorf" language="de"/>
    </Detail>
  </MetaData>
  <MetaData>
    <Detail primaryKey="2314eb9f-7207-409f-a0d4-89b6a1177363">
      <Description value="Reben" language="de"/>
    </Detail>
    <Detail primaryKey="00000000-0000-0000-0000-000000000099">
      <Description value="Kernobst" language="de"/>
    </Detail>
  </MetaData>
</PublicationData>
```

**Hinweis:** Das echte XML hat 22 `MetaData`-Blöcke. Wir identifizieren die Sektionen anhand der enthaltenen `primaryKey`-Werte (welche IDs taucht in welchen Inhalten als Referenz auf?) — siehe Parser-Implementierung. Im Sample-XML legen wir die drei interessanten Sektionen (Substances, Pests, Cultures) in dieser Reihenfolge ab.

Da die echten Sektionen *nicht* per Tag-Name unterscheidbar sind: der Parser identifiziert sie über die *referenzierten* IDs. Wir machen das so: nach dem Streamen der Products kennen wir alle referenzierten Substance/Pest/Culture-IDs. Erst dann lesen wir die MetaData-Sektionen und matchen `primaryKey` gegen die jeweilige Menge.

- [ ] **Step 2: Failing Test schreiben**

```go
// apps/backend/internal/psm/xml_test.go
package psm_test

import (
    "os"
    "testing"

    "github.com/google/uuid"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    "wingert/backend/internal/psm"
)

const rebenCultureID = "2314eb9f-7207-409f-a0d4-89b6a1177363"

func TestParseXMLFiltersByCulture(t *testing.T) {
    f, err := os.Open("testdata/sample.xml")
    require.NoError(t, err)
    defer f.Close()

    batch, err := psm.ParseXML(f, rebenCultureID)
    require.NoError(t, err)

    // Nur Aktuan (Reben) bleibt; NurApfel (Kernobst) wird ausgefiltert
    require.Len(t, batch.Products, 1)
    assert.Equal(t, "4090", batch.Products[0].ID)
    assert.Equal(t, "Aktuan", batch.Products[0].Name)

    // Nur die zwei vom Aktuan referenzierten Substances
    require.Len(t, batch.Substances, 2)
    sids := []uuid.UUID{batch.Substances[0].ID, batch.Substances[1].ID}
    assert.Contains(t, sids, uuid.MustParse("9d9a5c3d-1941-4fc3-9111-1fe4cd86e28b"))
    assert.Contains(t, sids, uuid.MustParse("63c58a64-ed05-473a-a71d-1b266552e710"))

    // Nur ein referenzierter Pest
    require.Len(t, batch.Pests, 1)
    assert.Equal(t, "Falscher Mehltau der Rebe", batch.Pests[0].NameDE)

    require.Len(t, batch.ProductSubstances, 2)
    require.Len(t, batch.Indications, 1)
    assert.Equal(t, 56, *batch.Indications[0].WaitingPeriodDays)
}
```

- [ ] **Step 3: Test ausführen, FAIL erwartet**

Run: `cd apps/backend && go test ./internal/psm/... -run TestParseXML -timeout 30s`
Expected: FAIL — Package `psm` und `ParseXML` existieren nicht.

- [ ] **Step 4: XML-Parser implementieren**

```go
// apps/backend/internal/psm/xml.go
package psm

import (
    "encoding/xml"
    "io"
    "strconv"

    "github.com/google/uuid"
    "wingert/backend/internal/domain"
)

// ParseXML reads the BLV PublicationData XML and returns a PSMBatch
// containing only entities relevant to the given culture (e.g. Reben).
// Two-pass approach: first pass collects products+indications+ingredients
// that target the target culture; second pass picks the metadata for the
// referenced substance/pest IDs (we then re-stream the XML).
func ParseXML(r io.ReadSeeker, targetCultureID string) (domain.PSMBatch, error) {
    var batch domain.PSMBatch

    targetCulture, err := uuid.Parse(targetCultureID)
    if err != nil {
        return batch, err
    }

    // ── Pass 1: products + indications + ingredients ────────────────────
    type ingestState struct {
        currentProduct *xmlProduct
        keepProduct    bool
    }

    referencedSubstances := map[uuid.UUID]struct{}{}
    referencedPests := map[uuid.UUID]struct{}{}

    if _, err := r.Seek(0, io.SeekStart); err != nil {
        return batch, err
    }
    dec := xml.NewDecoder(r)
    for {
        tok, err := dec.Token()
        if err == io.EOF { break }
        if err != nil { return batch, err }

        se, ok := tok.(xml.StartElement)
        if !ok { continue }

        switch se.Name.Local {
        case "Product", "Parallelimport":
            var p xmlProduct
            if err := dec.DecodeElement(&p, &se); err != nil {
                return batch, err
            }
            keep := false
            for _, ind := range p.ProductInformation.Indications {
                for _, c := range ind.Cultures {
                    cID, err := uuid.Parse(c.PrimaryKey)
                    if err == nil && cID == targetCulture {
                        keep = true
                        break
                    }
                }
                if keep { break }
            }
            if !keep { continue }

            isParallel := se.Name.Local == "Parallelimport"
            batch.Products = append(batch.Products, domain.PSMProduct{
                ID:               p.ID,
                WNbr:             p.WNbr,
                Name:             p.Name,
                IsParallelImport: isParallel,
            })
            for _, ing := range p.ProductInformation.Ingredients {
                for _, sub := range ing.Substances {
                    sid, err := uuid.Parse(sub.PrimaryKey)
                    if err != nil { continue }
                    referencedSubstances[sid] = struct{}{}
                    batch.ProductSubstances = append(batch.ProductSubstances, domain.PSMProductSubstance{
                        ProductID:        p.ID,
                        SubstanceID:      sid,
                        InPercent:        parseFloat(ing.InPercent),
                        InGrammPerLitre:  parseFloat(ing.InGrammPerLitre),
                    })
                }
            }
            for _, ind := range p.ProductInformation.Indications {
                // skip if no target-culture (mixed-culture product)
                cultMatch := false
                for _, c := range ind.Cultures {
                    if cID, err := uuid.Parse(c.PrimaryKey); err == nil && cID == targetCulture {
                        cultMatch = true
                        break
                    }
                }
                if !cultMatch { continue }
                for _, pest := range ind.Pests {
                    pid, err := uuid.Parse(pest.PrimaryKey)
                    if err != nil { continue }
                    referencedPests[pid] = struct{}{}
                    wp := parseInt(ind.WaitingPeriod)
                    batch.Indications = append(batch.Indications, domain.PSMIndication{
                        ProductID:         p.ID,
                        PestID:            pid,
                        DosageFrom:        parseFloat(ind.DosageFrom),
                        DosageTo:          parseFloat(ind.DosageTo),
                        DosageUnit:        ind.ExpenditureForm,
                        WaitingPeriodDays: wp,
                    })
                }
            }
        }
    }

    // ── Pass 2: metadata for referenced IDs ─────────────────────────────
    if _, err := r.Seek(0, io.SeekStart); err != nil {
        return batch, err
    }
    dec = xml.NewDecoder(r)
    substancesByID := map[uuid.UUID]string{}
    pestsByID := map[uuid.UUID]string{}
    for {
        tok, err := dec.Token()
        if err == io.EOF { break }
        if err != nil { return batch, err }
        se, ok := tok.(xml.StartElement)
        if !ok { continue }
        if se.Name.Local != "Detail" { continue }
        var d xmlDetail
        if err := dec.DecodeElement(&d, &se); err != nil {
            return batch, err
        }
        id, err := uuid.Parse(d.PrimaryKey)
        if err != nil { continue }
        nameDE := pickLang(d.Descriptions, "de")
        if _, ok := referencedSubstances[id]; ok && substancesByID[id] == "" {
            substancesByID[id] = nameDE
        }
        if _, ok := referencedPests[id]; ok && pestsByID[id] == "" {
            pestsByID[id] = nameDE
        }
    }
    for id, name := range substancesByID {
        batch.Substances = append(batch.Substances, domain.PSMSubstance{ID: id, NameDE: name})
    }
    for id, name := range pestsByID {
        batch.Pests = append(batch.Pests, domain.PSMPest{ID: id, NameDE: name})
    }
    return batch, nil
}

func pickLang(descs []xmlDescription, lang string) string {
    for _, d := range descs {
        if d.Language == lang { return d.Value }
    }
    if len(descs) > 0 { return descs[0].Value }
    return ""
}

func parseFloat(s string) *float64 {
    if s == "" { return nil }
    f, err := strconv.ParseFloat(s, 64)
    if err != nil { return nil }
    return &f
}

func parseInt(s string) *int {
    if s == "" { return nil }
    i, err := strconv.Atoi(s)
    if err != nil { return nil }
    return &i
}

// ── XML stubs ─────────────────────────────────────────────────────────

type xmlProduct struct {
    ID                  string                 `xml:"id,attr"`
    WNbr                string                 `xml:"wNbr,attr"`
    Name                string                 `xml:"name,attr"`
    ExhaustionDeadline  string                 `xml:"exhaustionDeadline,attr"`
    SoldoutDeadline     string                 `xml:"soldoutDeadline,attr"`
    ProductInformation  xmlProductInformation  `xml:"ProductInformation"`
}

type xmlProductInformation struct {
    Ingredients  []xmlIngredient  `xml:"Ingredient"`
    Indications  []xmlIndication  `xml:"Indication"`
}

type xmlIngredient struct {
    InPercent       string         `xml:"inPercent,attr"`
    InGrammPerLitre string         `xml:"inGrammPerLitre,attr"`
    Substances      []xmlIDRef     `xml:"Substance"`
}

type xmlIndication struct {
    DosageFrom      string      `xml:"dosageFrom,attr"`
    DosageTo        string      `xml:"dosageTo,attr"`
    WaitingPeriod   string      `xml:"waitingPeriod,attr"`
    ExpenditureForm string      `xml:"expenditureForm,attr"`
    Cultures        []xmlIDRef  `xml:"Culture"`
    Pests           []xmlIDRef  `xml:"Pest"`
}

type xmlIDRef struct {
    PrimaryKey string `xml:"primaryKey,attr"`
}

type xmlDetail struct {
    PrimaryKey   string           `xml:"primaryKey,attr"`
    Descriptions []xmlDescription `xml:"Description"`
}

type xmlDescription struct {
    Value    string `xml:"value,attr"`
    Language string `xml:"language,attr"`
}
```

- [ ] **Step 5: Tests ausführen, PASS erwartet**

Run: `cd apps/backend && go test ./internal/psm/... -run TestParseXML -timeout 30s -v`
Expected: PASS.

---

### Task 4: PSM Sync-Service

**Files:**
- Create: `apps/backend/internal/psm/sync.go`
- Create: `apps/backend/internal/psm/sync_test.go`

- [ ] **Step 1: Failing Test schreiben (HTTP-Server + In-Memory-Repo)**

```go
// apps/backend/internal/psm/sync_test.go
package psm_test

import (
    "archive/zip"
    "bytes"
    "context"
    "io"
    "net/http"
    "net/http/httptest"
    "os"
    "sync"
    "testing"
    "time"

    "github.com/google/uuid"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    "wingert/backend/internal/domain"
    "wingert/backend/internal/psm"
)

// fakeRepo implements domain.PSMRepository for the sync test.
type fakeRepo struct {
    mu    sync.Mutex
    batch *domain.PSMBatch
    meta  *domain.PSMSyncMeta
}

func (r *fakeRepo) UpsertBatch(b domain.PSMBatch) error {
    r.mu.Lock(); defer r.mu.Unlock()
    r.batch = &b
    return nil
}
func (r *fakeRepo) SetMeta(m domain.PSMSyncMeta) error {
    r.mu.Lock(); defer r.mu.Unlock()
    r.meta = &m
    return nil
}
func (r *fakeRepo) Meta() (*domain.PSMSyncMeta, error) { return r.meta, nil }
func (r *fakeRepo) SearchProducts(string, int) ([]domain.PSMProduct, error)   { return nil, nil }
func (r *fakeRepo) GetProduct(string) (*domain.PSMProduct, error)             { return nil, nil }
func (r *fakeRepo) SearchSubstances(string, int) ([]domain.PSMSubstance, error){ return nil, nil }
func (r *fakeRepo) GetPestsForSubstances([]uuid.UUID) ([]uuid.UUID, error)    { return nil, nil }

func buildZip(t *testing.T) []byte {
    t.Helper()
    raw, err := os.ReadFile("testdata/sample.xml")
    require.NoError(t, err)
    var buf bytes.Buffer
    zw := zip.NewWriter(&buf)
    w, err := zw.Create("PublicationData.xml")
    require.NoError(t, err)
    _, err = io.Copy(w, bytes.NewReader(raw))
    require.NoError(t, err)
    require.NoError(t, zw.Close())
    return buf.Bytes()
}

func TestSync_DownloadsAndUpserts(t *testing.T) {
    zipBytes := buildZip(t)
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Type", "application/zip")
        _, _ = w.Write(zipBytes)
    }))
    defer server.Close()

    repo := &fakeRepo{}
    svc := psm.NewSyncService(repo, server.URL, "2314eb9f-7207-409f-a0d4-89b6a1177363")

    err := svc.Sync(context.Background())
    require.NoError(t, err)
    require.NotNil(t, repo.batch)
    assert.Len(t, repo.batch.Products, 1)
    assert.Equal(t, "Aktuan", repo.batch.Products[0].Name)
    require.NotNil(t, repo.meta)
    assert.Equal(t, "ok", repo.meta.Status)
}

func TestSync_RecentSkips(t *testing.T) {
    repo := &fakeRepo{meta: &domain.PSMSyncMeta{
        LastSyncAt: time.Now().Add(-1 * time.Hour),
        Status:     "ok",
    }}
    svc := psm.NewSyncService(repo, "http://invalid", "2314eb9f-7207-409f-a0d4-89b6a1177363")
    err := svc.Sync(context.Background())
    require.NoError(t, err) // skip is not an error
}
```

- [ ] **Step 2: Test ausführen, FAIL erwartet**

Run: `cd apps/backend && go test ./internal/psm/... -run TestSync -timeout 30s`
Expected: FAIL — `psm.NewSyncService` existiert nicht.

- [ ] **Step 3: Sync-Service implementieren**

```go
// apps/backend/internal/psm/sync.go
package psm

import (
    "archive/zip"
    "bytes"
    "context"
    "fmt"
    "io"
    "net/http"
    "sync"
    "time"

    "wingert/backend/internal/domain"
)

const (
    DefaultPSMZipURL      = "https://www.blv.admin.ch/dam/blv/de/dokumente/zulassung-pflanzenschutzmittel/pflanzenschutzmittelverzeichnis/daten-pflanzenschutzmittelverzeichnis.zip.download.zip/Daten%20Pflanzenschutzmittelverzeichnis.zip"
    DefaultMinSyncSpacing = 7 * 24 * time.Hour
)

type SyncService struct {
    repo            domain.PSMRepository
    url             string
    cultureID       string
    httpClient      *http.Client
    minSyncSpacing  time.Duration
    mu              sync.Mutex
}

func NewSyncService(repo domain.PSMRepository, url, cultureID string) *SyncService {
    return &SyncService{
        repo:           repo,
        url:            url,
        cultureID:      cultureID,
        httpClient:     &http.Client{Timeout: 5 * time.Minute},
        minSyncSpacing: DefaultMinSyncSpacing,
    }
}

func (s *SyncService) Sync(ctx context.Context) error {
    s.mu.Lock()
    defer s.mu.Unlock()

    if meta, err := s.repo.Meta(); err == nil && meta != nil {
        if meta.Status == "ok" && time.Since(meta.LastSyncAt) < s.minSyncSpacing {
            return nil
        }
    }

    started := time.Now()
    // status=running setzen (best-effort)
    _ = s.repo.SetMeta(domain.PSMSyncMeta{LastSyncAt: started, Status: "running"})

    req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.url, nil)
    if err != nil { return s.fail(err) }
    resp, err := s.httpClient.Do(req)
    if err != nil { return s.fail(err) }
    defer resp.Body.Close()
    if resp.StatusCode != http.StatusOK {
        return s.fail(fmt.Errorf("psm download: status %d", resp.StatusCode))
    }
    body, err := io.ReadAll(resp.Body)
    if err != nil { return s.fail(err) }

    zr, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
    if err != nil { return s.fail(err) }
    var xmlFile *zip.File
    for _, f := range zr.File {
        if len(f.Name) > 4 && f.Name[len(f.Name)-4:] == ".xml" && f.Name != "XSD-Schema.xsd" {
            // skip duplicate "PublicationData_YYYY_MM_DD.xml"
            if xmlFile == nil || f.Name == "PublicationData.xml" {
                xmlFile = f
            }
        }
    }
    if xmlFile == nil {
        return s.fail(fmt.Errorf("psm zip: no PublicationData.xml inside"))
    }

    rc, err := xmlFile.Open()
    if err != nil { return s.fail(err) }
    defer rc.Close()
    xmlBytes, err := io.ReadAll(rc)
    if err != nil { return s.fail(err) }

    batch, err := ParseXML(bytes.NewReader(xmlBytes), s.cultureID)
    if err != nil { return s.fail(err) }
    batch.SyncedAt = started

    if err := s.repo.UpsertBatch(batch); err != nil {
        return s.fail(err)
    }

    return s.repo.SetMeta(domain.PSMSyncMeta{
        LastSyncAt:    time.Now(),
        ProductCount:  len(batch.Products),
        Status:        "ok",
    })
}

func (s *SyncService) fail(err error) error {
    _ = s.repo.SetMeta(domain.PSMSyncMeta{
        LastSyncAt:   time.Now(),
        Status:       "failed",
        ErrorMessage: err.Error(),
    })
    return err
}
```

`bytes.NewReader` erfüllt das `io.ReadSeeker`-Interface — passt zu `ParseXML`.

- [ ] **Step 4: Tests ausführen, PASS erwartet**

Run: `cd apps/backend && go test ./internal/psm/... -timeout 60s -v`
Expected: PASS für TestParseXML, TestSync_DownloadsAndUpserts, TestSync_RecentSkips.

---

### Task 5: Spray & Protection-Period Stores

**Files:**
- Create: `apps/backend/internal/domain/protection.go`
- Create: `apps/backend/internal/store/spray.go`
- Create: `apps/backend/internal/store/protection_period.go`
- Create: `apps/backend/internal/store/spray_test.go`

- [ ] **Step 1: Domain-Typen**

```go
// apps/backend/internal/domain/protection.go
package domain

import (
    "time"
    "github.com/google/uuid"
)

type SprayApplication struct {
    TaskID          uuid.UUID   `json:"taskId"`
    ProductID       *string     `json:"productId,omitempty"`
    SubstanceIDs    []uuid.UUID `json:"substanceIds"`
    TargetPestIDs   []uuid.UUID `json:"targetPestIds,omitempty"`
    Dosage          *float64    `json:"dosage,omitempty"`
    DosageUnit      string      `json:"dosageUnit,omitempty"`
    AppliedAt       time.Time   `json:"appliedAt"`
    Notes           string      `json:"notes,omitempty"`
}

type ProtectionPeriodKind string

const (
    ProtectionPeriodDispenser   ProtectionPeriodKind = "dispenser"
    ProtectionPeriodMowingPause ProtectionPeriodKind = "mowing-pause"
)

type ProtectionPeriod struct {
    ID             uuid.UUID            `json:"id"`
    VineyardID     uuid.UUID            `json:"vineyardId"`
    Kind           ProtectionPeriodKind `json:"kind"`
    StartTaskID    uuid.UUID            `json:"startTaskId"`
    EndTaskID      *uuid.UUID           `json:"endTaskId,omitempty"`
    StartAt        time.Time            `json:"startAt"`
    EndAt          *time.Time           `json:"endAt,omitempty"`
    TargetPestIDs  []uuid.UUID          `json:"targetPestIds"`
}

type SprayRepository interface {
    Create(s SprayApplication) error
    FindByVineyard(vineyardID uuid.UUID, since time.Time) ([]SprayApplication, error)
}

type ProtectionPeriodRepository interface {
    Create(p ProtectionPeriod) error
    FindActive(vineyardID uuid.UUID, kind ProtectionPeriodKind) (*ProtectionPeriod, error)
    CloseLatest(vineyardID uuid.UUID, kind ProtectionPeriodKind, endTaskID uuid.UUID, endAt time.Time) error
}
```

- [ ] **Step 2: Failing Tests schreiben**

```go
// apps/backend/internal/store/spray_test.go
package store_test

import (
    "testing"
    "time"

    "github.com/google/uuid"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    "wingert/backend/internal/domain"
    "wingert/backend/internal/store"
    "wingert/backend/internal/testutil"
)

func TestSprayStore_RoundTrip(t *testing.T) {
    db, cleanup := testutil.NewPostgresContainer(t)
    defer cleanup()
    testutil.RunMigrations(t, db)

    // Insert a user, vineyard, task as FK parents
    userID := uuid.New()
    require.NoError(t, db.Exec(
        `INSERT INTO users (id, email, name, role, password_hash, created_at)
         VALUES (?, 'a@b', 'X', 'admin', 'x', NOW())`, userID).Error)
    vyID := uuid.New()
    require.NoError(t, db.Exec(
        `INSERT INTO vineyards (id, name, owner_id, created_at)
         VALUES (?, 'V', ?, NOW())`, vyID, userID).Error)
    taskID := uuid.New()
    require.NoError(t, db.Exec(
        `INSERT INTO tasks (id, vineyard_id, title, record_type, category, status, created_at, subtype)
         VALUES (?, ?, 'Spritzung', 'aufgabe', 'pflanzenschutz', 'erledigt', NOW(), 'spritzung')`,
        taskID, vyID).Error)

    s := store.NewSprayStore(db)
    sid := uuid.New()
    when := time.Now()
    require.NoError(t, s.Create(domain.SprayApplication{
        TaskID:        taskID,
        SubstanceIDs:  []uuid.UUID{sid},
        AppliedAt:     when,
    }))

    res, err := s.FindByVineyard(vyID, when.Add(-time.Hour))
    require.NoError(t, err)
    require.Len(t, res, 1)
    assert.Equal(t, taskID, res[0].TaskID)
    assert.Equal(t, []uuid.UUID{sid}, res[0].SubstanceIDs)
}
```

- [ ] **Step 3: Test ausführen, FAIL erwartet**

Run: `cd apps/backend && go test ./internal/store/... -run TestSprayStore -timeout 120s`
Expected: FAIL — `store.SprayStore` fehlt.

- [ ] **Step 4: SprayStore und ProtectionPeriodStore implementieren**

```go
// apps/backend/internal/store/spray.go
package store

import (
    "time"

    "github.com/google/uuid"
    "github.com/lib/pq"
    "gorm.io/gorm"
    "wingert/backend/internal/domain"
)

type SprayStore struct{ db *gorm.DB }

func NewSprayStore(db *gorm.DB) *SprayStore { return &SprayStore{db: db} }

func (s *SprayStore) Create(a domain.SprayApplication) error {
    return s.db.Exec(`
        INSERT INTO spray_applications (task_id, product_id, substance_ids, target_pest_ids,
            dosage, dosage_unit, applied_at, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        a.TaskID, a.ProductID, pq.Array(a.SubstanceIDs),
        pq.Array(a.TargetPestIDs), a.Dosage, a.DosageUnit, a.AppliedAt, a.Notes).Error
}

func (s *SprayStore) FindByVineyard(vineyardID uuid.UUID, since time.Time) ([]domain.SprayApplication, error) {
    var rows []struct {
        TaskID         uuid.UUID  `gorm:"column:task_id"`
        ProductID      *string    `gorm:"column:product_id"`
        SubstanceIDs   pq.StringArray `gorm:"column:substance_ids"`
        TargetPestIDs  pq.StringArray `gorm:"column:target_pest_ids"`
        Dosage         *float64
        DosageUnit     string     `gorm:"column:dosage_unit"`
        AppliedAt      time.Time  `gorm:"column:applied_at"`
        Notes          string
    }
    err := s.db.Raw(`
        SELECT sa.task_id, sa.product_id, sa.substance_ids::text[], sa.target_pest_ids::text[],
               sa.dosage, sa.dosage_unit, sa.applied_at, sa.notes
        FROM spray_applications sa
        JOIN tasks t ON t.id = sa.task_id
        WHERE t.vineyard_id = ? AND sa.applied_at >= ?
        ORDER BY sa.applied_at DESC`, vineyardID, since).Scan(&rows).Error
    if err != nil { return nil, err }

    out := make([]domain.SprayApplication, len(rows))
    for i, r := range rows {
        out[i] = domain.SprayApplication{
            TaskID: r.TaskID, ProductID: r.ProductID,
            SubstanceIDs:  parseUUIDArray(r.SubstanceIDs),
            TargetPestIDs: parseUUIDArray(r.TargetPestIDs),
            Dosage: r.Dosage, DosageUnit: r.DosageUnit,
            AppliedAt: r.AppliedAt, Notes: r.Notes,
        }
    }
    return out, nil
}

func parseUUIDArray(s pq.StringArray) []uuid.UUID {
    out := make([]uuid.UUID, 0, len(s))
    for _, v := range s {
        if u, err := uuid.Parse(v); err == nil {
            out = append(out, u)
        }
    }
    return out
}
```

```go
// apps/backend/internal/store/protection_period.go
package store

import (
    "time"

    "github.com/google/uuid"
    "github.com/lib/pq"
    "gorm.io/gorm"
    "wingert/backend/internal/domain"
)

type ProtectionPeriodStore struct{ db *gorm.DB }

func NewProtectionPeriodStore(db *gorm.DB) *ProtectionPeriodStore {
    return &ProtectionPeriodStore{db: db}
}

func (s *ProtectionPeriodStore) Create(p domain.ProtectionPeriod) error {
    return s.db.Exec(`
        INSERT INTO protection_periods (id, vineyard_id, kind, start_task_id,
            end_task_id, start_at, end_at, target_pest_ids)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        p.ID, p.VineyardID, p.Kind, p.StartTaskID,
        p.EndTaskID, p.StartAt, p.EndAt, pq.Array(p.TargetPestIDs)).Error
}

func (s *ProtectionPeriodStore) FindActive(vineyardID uuid.UUID, kind domain.ProtectionPeriodKind) (*domain.ProtectionPeriod, error) {
    var row struct {
        ID             uuid.UUID      `gorm:"column:id"`
        VineyardID     uuid.UUID      `gorm:"column:vineyard_id"`
        Kind           string         `gorm:"column:kind"`
        StartTaskID    uuid.UUID      `gorm:"column:start_task_id"`
        EndTaskID      *uuid.UUID     `gorm:"column:end_task_id"`
        StartAt        time.Time      `gorm:"column:start_at"`
        EndAt          *time.Time     `gorm:"column:end_at"`
        TargetPestIDs  pq.StringArray `gorm:"column:target_pest_ids"`
    }
    err := s.db.Raw(`
        SELECT id, vineyard_id, kind, start_task_id, end_task_id, start_at, end_at,
               target_pest_ids::text[]
        FROM protection_periods
        WHERE vineyard_id = ? AND kind = ? AND end_at IS NULL
        ORDER BY start_at DESC LIMIT 1`, vineyardID, kind).Scan(&row).Error
    if err != nil { return nil, err }
    if row.ID == uuid.Nil { return nil, nil }
    return &domain.ProtectionPeriod{
        ID: row.ID, VineyardID: row.VineyardID,
        Kind: domain.ProtectionPeriodKind(row.Kind),
        StartTaskID: row.StartTaskID, EndTaskID: row.EndTaskID,
        StartAt: row.StartAt, EndAt: row.EndAt,
        TargetPestIDs: parseUUIDArray(row.TargetPestIDs),
    }, nil
}

func (s *ProtectionPeriodStore) CloseLatest(vineyardID uuid.UUID, kind domain.ProtectionPeriodKind, endTaskID uuid.UUID, endAt time.Time) error {
    return s.db.Exec(`
        UPDATE protection_periods
        SET end_at = ?, end_task_id = ?
        WHERE id = (
            SELECT id FROM protection_periods
            WHERE vineyard_id = ? AND kind = ? AND end_at IS NULL
            ORDER BY start_at DESC LIMIT 1)`,
        endAt, endTaskID, vineyardID, kind).Error
}
```

- [ ] **Step 5: Tests ausführen, PASS erwartet**

Run: `cd apps/backend && go test ./internal/store/... -timeout 120s -v`
Expected: PASS für alle Store-Tests.

---

### Task 6: Agrometeo-Erweiterung — FetchModelGeojson

**Files:**
- Modify: `apps/backend/internal/agrometeo/client.go`
- Modify: `apps/backend/internal/agrometeo/cache.go`
- Create: `apps/backend/internal/agrometeo/client_test.go`

- [ ] **Step 1: Failing Test schreiben (mit httptest)**

```go
// apps/backend/internal/agrometeo/client_test.go
package agrometeo_test

import (
    "context"
    "net/http"
    "net/http/httptest"
    "testing"
    "time"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    "wingert/backend/internal/agrometeo"
)

func TestFetchModelGeojson(t *testing.T) {
    server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        assert.Equal(t, "/api/models/7/geojson", r.URL.Path)
        assert.Equal(t, "2026-05-12", r.URL.Query().Get("date"))
        w.Header().Set("Content-Type", "application/json")
        _, _ = w.Write([]byte(`{
            "type":"FeatureCollection",
            "features":[
                {"type":"Feature","id":138,"properties":{
                    "station_id":138,"station_name":"SARGANS",
                    "index":226.86,"color":"red","time":"2026-05-12 00:00:00"}}
            ]
        }`))
    }))
    defer server.Close()

    c := agrometeo.NewClientWithBase(server.URL + "/api")
    date := time.Date(2026, 5, 12, 0, 0, 0, 0, time.UTC)
    feats, err := c.FetchModelGeojson(context.Background(), 7, date)
    require.NoError(t, err)
    require.Len(t, feats, 1)
    assert.Equal(t, 138, feats[0].StationID)
    assert.Equal(t, "SARGANS", feats[0].StationName)
    assert.InDelta(t, 226.86, feats[0].Index, 0.001)
    assert.Equal(t, "red", feats[0].Color)
}
```

- [ ] **Step 2: Test ausführen, FAIL erwartet**

Run: `cd apps/backend && go test ./internal/agrometeo/... -timeout 30s -run TestFetchModelGeojson`
Expected: FAIL.

- [ ] **Step 3: Client erweitern**

In `apps/backend/internal/agrometeo/client.go` ergänzen:

```go
// ── Modell-Geojson ─────────────────────────────────────────────────

type ModelFeature struct {
    StationID    int     `json:"stationId"`
    StationName  string  `json:"stationName"`
    Index        float64 `json:"index"`
    Color        string  `json:"color"`
    Time         string  `json:"time"`
    // Modell-spezifische Zusatzfelder optional:
    Risikolevel  *int    `json:"risikolevel,omitempty"`
    Risikostufe  *int    `json:"risikostufe,omitempty"`
}

// NewClientWithBase constructs a Client with a custom base URL (testing).
func NewClientWithBase(base string) *Client {
    return &Client{http: &http.Client{Timeout: 10 * time.Second}, baseOverride: base}
}

func (c *Client) base() string {
    if c.baseOverride != "" { return c.baseOverride }
    return baseURL
}

func (c *Client) FetchModelGeojson(ctx context.Context, modelID int, date time.Time) ([]ModelFeature, error) {
    url := fmt.Sprintf("/models/%d/geojson?date=%s", modelID, date.Format("2006-01-02"))
    var resp struct {
        Features []struct {
            Properties struct {
                StationID    int     `json:"station_id"`
                StationName  string  `json:"station_name"`
                Index        float64 `json:"index"`
                Color        string  `json:"color"`
                Time         string  `json:"time"`
                Risikolevel  *int    `json:"Risikolevel,omitempty"`
                Risikostufe  *int    `json:"Risikostufe,omitempty"`
            } `json:"properties"`
        } `json:"features"`
    }
    if err := c.get(ctx, url, &resp); err != nil {
        return nil, err
    }
    out := make([]ModelFeature, len(resp.Features))
    for i, f := range resp.Features {
        out[i] = ModelFeature{
            StationID:   f.Properties.StationID,
            StationName: f.Properties.StationName,
            Index:       f.Properties.Index,
            Color:       f.Properties.Color,
            Time:        f.Properties.Time,
            Risikolevel: f.Properties.Risikolevel,
            Risikostufe: f.Properties.Risikostufe,
        }
    }
    return out, nil
}
```

Und am `Client` struct das Feld `baseOverride` ergänzen:

```go
type Client struct {
    http         *http.Client
    baseOverride string
}
```

`c.get` muss `c.base()` statt `baseURL` verwenden — ändere die Funktion:

```go
func (c *Client) get(ctx context.Context, path string, dst any) error {
    req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.base()+path, nil)
    // ... Rest unverändert
}
```

- [ ] **Step 4: Cache erweitern**

In `apps/backend/internal/agrometeo/cache.go`:

```go
type modelKey struct {
    modelID int
    date    string // YYYY-MM-DD
}

type modelEntry struct {
    data      []ModelFeature
    expiresAt time.Time
}

// add to Cache struct:
//    models map[modelKey]modelEntry

// add to NewCache:
//    return &Cache{weather: ..., models: make(map[modelKey]modelEntry)}

func (c *Cache) GetModel(modelID int, date time.Time) ([]ModelFeature, bool) {
    c.mu.Lock(); defer c.mu.Unlock()
    k := modelKey{modelID, date.Format("2006-01-02")}
    e, ok := c.models[k]
    if !ok || time.Now().After(e.expiresAt) { return nil, false }
    return e.data, true
}

func (c *Cache) SetModel(modelID int, date time.Time, data []ModelFeature) {
    c.mu.Lock(); defer c.mu.Unlock()
    k := modelKey{modelID, date.Format("2006-01-02")}
    ttl := 24 * time.Hour
    if !date.Before(time.Now().Truncate(24 * time.Hour)) {
        ttl = 30 * time.Minute
    }
    c.models[k] = modelEntry{data: data, expiresAt: time.Now().Add(ttl)}
}
```

Im `Cache` struct den `models` Map ergänzen und in `NewCache` initialisieren (siehe Kommentare oben).

- [ ] **Step 5: Tests ausführen, PASS erwartet**

Run: `cd apps/backend && go test ./internal/agrometeo/... -timeout 30s -v`
Expected: PASS.

---

### Task 7: protection.Config und Combinator

**Files:**
- Create: `apps/backend/internal/protection/config.go`
- Create: `apps/backend/internal/protection/combinator.go`
- Create: `apps/backend/internal/protection/combinator_test.go`

- [ ] **Step 1: Config schreiben (Diseases als Konstanten)**

```go
// apps/backend/internal/protection/config.go
package protection

import "github.com/google/uuid"

const (
    RebenCultureID             = "2314eb9f-7207-409f-a0d4-89b6a1177363"
    DefaultSprayProtectionDays = 12
)

type MeasureType string

const (
    MeasureSpray         MeasureType = "spray"
    MeasureDispenser     MeasureType = "dispenser"
    MeasureMowingPause   MeasureType = "mowing-pause"
    MeasureInfoOnly      MeasureType = ""
)

type ThresholdRule struct {
    YellowAt float64
    RedAt    float64
    UseField string // "index" (default) | "risikolevel" | "risikostufe"
}

type Disease struct {
    Key              string
    Name             string
    AgrometeoModelID int
    PSMPestIDs       []uuid.UUID
    Measure          MeasureType
    Thresholds       ThresholdRule
    InCardAggregate  bool   // ob in Worst-Of der Karten-Übersicht enthalten
    InfoURL          string
}

func mustUUID(s string) uuid.UUID { return uuid.MustParse(s) }

var Diseases = []Disease{
    {Key: "mildiou", Name: "Falscher Mehltau", AgrometeoModelID: 7,
        PSMPestIDs: []uuid.UUID{mustUUID("0251feea-4e71-4881-8b0a-09874f39277a")},
        Measure: MeasureSpray, Thresholds: ThresholdRule{YellowAt: 50, RedAt: 100},
        InCardAggregate: true, InfoURL: "https://www.agrometeo.ch/"},
    {Key: "oidium", Name: "Echter Mehltau", AgrometeoModelID: 8,
        PSMPestIDs: []uuid.UUID{mustUUID("9060aec1-f131-4c7e-ab10-40bafec297b3")},
        Measure: MeasureSpray, Thresholds: ThresholdRule{YellowAt: 34, RedAt: 67},
        InCardAggregate: true},
    {Key: "black-rot", Name: "Black Rot", AgrometeoModelID: 11,
        PSMPestIDs: []uuid.UUID{mustUUID("0827836e-3719-423d-9340-5413debc42b4")},
        Measure: MeasureSpray, Thresholds: ThresholdRule{YellowAt: 85, RedAt: 150},
        InCardAggregate: true},
    {Key: "botrytis", Name: "Botrytis", AgrometeoModelID: 15,
        PSMPestIDs: []uuid.UUID{mustUUID("02ee16ea-7294-4d6d-aa3d-4a3ae7d5f6df")},
        Measure: MeasureSpray, Thresholds: ThresholdRule{YellowAt: 50, RedAt: 100},
        InCardAggregate: true},
    {Key: "acariose", Name: "Acariose / Kräuselmilbe", AgrometeoModelID: 12,
        PSMPestIDs: []uuid.UUID{mustUUID("204c2b56-cc1a-435d-b9ea-c493d9eb5115")},
        Measure: MeasureSpray, Thresholds: ThresholdRule{YellowAt: 300, RedAt: 550},
        InCardAggregate: true},
    {Key: "traubenwickler", Name: "Traubenwickler", AgrometeoModelID: 16,
        PSMPestIDs: []uuid.UUID{
            mustUUID("884fbf9b-a098-4936-9caa-57056026d69e"),
            mustUUID("5ac77f67-4abf-460f-825c-a82d635bda38"),
            mustUUID("711c42ab-e781-4501-b0f4-cfbbdc89c83f"),
        },
        Measure: MeasureDispenser, Thresholds: ThresholdRule{YellowAt: 2, RedAt: 3, UseField: "risikolevel"},
        InCardAggregate: false},
    {Key: "bois-noir", Name: "Bois Noir (Vergilbungskrankheit)", AgrometeoModelID: 9,
        PSMPestIDs: []uuid.UUID{mustUUID("41fc4719-6f5e-49af-80aa-a3f1f687e689")},
        Measure: MeasureMowingPause, Thresholds: ThresholdRule{YellowAt: 80, RedAt: 100},
        InCardAggregate: false},
    {Key: "phenologie", Name: "Phänologie", AgrometeoModelID: 14,
        Measure: MeasureInfoOnly, Thresholds: ThresholdRule{},
        InCardAggregate: false},
}

func DiseaseByKey(key string) *Disease {
    for i := range Diseases {
        if Diseases[i].Key == key { return &Diseases[i] }
    }
    return nil
}
```

- [ ] **Step 2: Failing Tests für Combinator schreiben**

```go
// apps/backend/internal/protection/combinator_test.go
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

func TestMapLevel(t *testing.T) {
    mildiou := *protection.DiseaseByKey("mildiou")
    assert.Equal(t, "grün", protection.MapLevel(mildiou, 0))
    assert.Equal(t, "gelb", protection.MapLevel(mildiou, 75))
    assert.Equal(t, "rot",  protection.MapLevel(mildiou, 200))
}

func TestCombine_NoMeasure(t *testing.T) {
    mildiou := *protection.DiseaseByKey("mildiou")
    raw := agrometeo.ModelFeature{Index: 226.86, Color: "red"}
    res := protection.Combine(mildiou, raw, nil, nil, time.Now())
    assert.Equal(t, "rot", res.RawLevel)
    assert.Equal(t, "rot", res.EffectiveLevel)
    assert.InDelta(t, 226.86, res.EffectiveIndex, 0.001)
}

func TestCombine_SpritzungReducesRisk(t *testing.T) {
    mildiou := *protection.DiseaseByKey("mildiou")
    raw := agrometeo.ModelFeature{Index: 200, Color: "red"}
    now := time.Date(2026, 5, 13, 12, 0, 0, 0, time.UTC)
    spray := &domain.SprayApplication{
        AppliedAt: now.Add(-6 * 24 * time.Hour), // 50% Schutz bei 12 Tagen
        TargetPestIDs: mildiou.PSMPestIDs,
    }
    res := protection.Combine(mildiou, raw, spray, nil, now)
    assert.Equal(t, "rot", res.RawLevel)
    assert.InDelta(t, 100, res.EffectiveIndex, 1)
    assert.Equal(t, "gelb", res.EffectiveLevel)
}

func TestCombine_SpritzungExpiredHasNoEffect(t *testing.T) {
    mildiou := *protection.DiseaseByKey("mildiou")
    raw := agrometeo.ModelFeature{Index: 200, Color: "red"}
    now := time.Date(2026, 5, 13, 12, 0, 0, 0, time.UTC)
    spray := &domain.SprayApplication{
        AppliedAt: now.Add(-20 * 24 * time.Hour), // 0% Schutz
        TargetPestIDs: mildiou.PSMPestIDs,
    }
    res := protection.Combine(mildiou, raw, spray, nil, now)
    assert.Equal(t, "rot", res.EffectiveLevel)
}

func TestCombine_DispenserOverridesGreen(t *testing.T) {
    tw := *protection.DiseaseByKey("traubenwickler")
    risiko := 3
    raw := agrometeo.ModelFeature{Index: 1676, Color: "purple", Risikolevel: &risiko}
    now := time.Date(2026, 5, 13, 12, 0, 0, 0, time.UTC)
    period := &domain.ProtectionPeriod{
        Kind: domain.ProtectionPeriodDispenser,
        StartAt: now.Add(-30 * 24 * time.Hour),
        TargetPestIDs: tw.PSMPestIDs,
    }
    res := protection.Combine(tw, raw, nil, period, now)
    assert.Equal(t, "rot", res.RawLevel)
    assert.Equal(t, "grün", res.EffectiveLevel)
    assert.Equal(t, "dispenser", string(res.MeasureType))
}

func TestCombine_TargetMismatchIgnoresSpray(t *testing.T) {
    mildiou := *protection.DiseaseByKey("mildiou")
    raw := agrometeo.ModelFeature{Index: 200}
    now := time.Date(2026, 5, 13, 12, 0, 0, 0, time.UTC)
    spray := &domain.SprayApplication{
        AppliedAt: now.Add(-1 * 24 * time.Hour),
        TargetPestIDs: []uuid.UUID{uuid.New()}, // anderer Pest
    }
    res := protection.Combine(mildiou, raw, spray, nil, now)
    assert.Equal(t, "rot", res.EffectiveLevel) // Spritzung trifft nicht
}
```

- [ ] **Step 3: Test ausführen, FAIL erwartet**

Run: `cd apps/backend && go test ./internal/protection/... -timeout 30s`
Expected: FAIL — `protection.Combine`, `protection.MapLevel` existieren nicht.

- [ ] **Step 4: Combinator implementieren**

```go
// apps/backend/internal/protection/combinator.go
package protection

import (
    "fmt"
    "time"

    "github.com/google/uuid"
    "wingert/backend/internal/agrometeo"
    "wingert/backend/internal/domain"
)

type DiseaseResult struct {
    Key             string
    Name            string
    ModelID         int
    RawIndex        float64
    RawLevel        string
    EffectiveIndex  float64
    EffectiveLevel  string
    MeasureType     MeasureType
    LastMeasureAt   *time.Time
    Recommendation  string
}

// indexFor returns the index value used for level mapping based on disease config.
func indexFor(d Disease, f agrometeo.ModelFeature) float64 {
    switch d.Thresholds.UseField {
    case "risikolevel":
        if f.Risikolevel != nil { return float64(*f.Risikolevel) }
    case "risikostufe":
        if f.Risikostufe != nil { return float64(*f.Risikostufe) }
    }
    return f.Index
}

func MapLevel(d Disease, index float64) string {
    if index < d.Thresholds.YellowAt { return "grün" }
    if index < d.Thresholds.RedAt    { return "gelb" }
    return "rot"
}

func Combine(d Disease, raw agrometeo.ModelFeature,
    spray *domain.SprayApplication, period *domain.ProtectionPeriod,
    now time.Time) DiseaseResult {

    rawIdx := indexFor(d, raw)
    rawLevel := MapLevel(d, rawIdx)
    res := DiseaseResult{
        Key: d.Key, Name: d.Name, ModelID: d.AgrometeoModelID,
        RawIndex: rawIdx, RawLevel: rawLevel,
        EffectiveIndex: rawIdx, EffectiveLevel: rawLevel,
    }

    if d.Measure == MeasureInfoOnly { return res }

    switch d.Measure {
    case MeasureSpray:
        if spray != nil && targetMatches(spray.TargetPestIDs, d.PSMPestIDs) {
            days := now.Sub(spray.AppliedAt).Hours() / 24
            protection := 1 - days/float64(DefaultSprayProtectionDays)
            if protection < 0 { protection = 0 }
            if protection > 1 { protection = 1 }
            effective := rawIdx * (1 - protection)
            res.EffectiveIndex = effective
            res.EffectiveLevel = MapLevel(d, effective)
            res.MeasureType = MeasureSpray
            t := spray.AppliedAt
            res.LastMeasureAt = &t
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
        if period != nil && period.Kind == domain.ProtectionPeriodMowingPause {
            res.EffectiveLevel = "grün"
            res.MeasureType = MeasureMowingPause
            t := period.StartAt
            res.LastMeasureAt = &t
            res.Recommendation = "Mahd-Pause aktiv"
            return res
        }
        res.Recommendation = recommendMowingPause(d, rawLevel)
    }

    return res
}

func targetMatches(taskPests, diseasePests []uuid.UUID) bool {
    // taskPests==nil bedeutet "alle Indikationen des Wirkstoffs" — wird
    // vom Aufrufer aufgelöst und dann hier mit den Disease-Pests gematcht.
    if len(taskPests) == 0 { return false }
    for _, p := range taskPests {
        for _, d := range diseasePests {
            if p == d { return true }
        }
    }
    return false
}

func recommendSpray(d Disease, level string, daysSince int) string {
    switch level {
    case "rot":
        if daysSince < 0 { return "Spritzung dringend empfohlen" }
        return "Schutz schwach — neue Spritzung empfohlen"
    case "gelb":
        return "Risiko erhöht — Spritzung im Blick behalten"
    default:
        return "Kein akutes Risiko"
    }
}

func recommendDispenser(d Disease, level string) string {
    if level == "rot" { return "Flugphase aktiv — Dispenser aufhängen empfohlen" }
    return "Aktuell kein Eingreifen nötig"
}

func recommendMowingPause(d Disease, level string) string {
    if level == "rot" { return "Brennnessel-Mahd jetzt aussetzen" }
    return "Mahd weiter möglich"
}
```

- [ ] **Step 5: Tests ausführen, PASS erwartet**

Run: `cd apps/backend && go test ./internal/protection/... -timeout 30s -v`
Expected: PASS für alle 6 Combinator-Tests.

---

### Task 8: protection.Service

**Files:**
- Create: `apps/backend/internal/protection/service.go`
- Create: `apps/backend/internal/protection/service_test.go`

- [ ] **Step 1: Failing Test schreiben**

```go
// apps/backend/internal/protection/service_test.go
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

// In-memory fakes
type fakeVineyards struct{ v *domain.Vineyard }
func (f *fakeVineyards) GetByID(id uuid.UUID) (*domain.Vineyard, error) { return f.v, nil }
func (f *fakeVineyards) List() ([]domain.Vineyard, error) { return nil, nil }
func (f *fakeVineyards) Create(domain.VineyardCreateParams) (*domain.Vineyard, error) { return nil, nil }
func (f *fakeVineyards) Update(uuid.UUID, domain.VineyardCreateParams) (*domain.Vineyard, error) { return nil, nil }
func (f *fakeVineyards) Delete(uuid.UUID) error { return nil }

type fakeAgrometeo struct {
    stations []agrometeo.Station
    features map[int][]agrometeo.ModelFeature
}
func (f *fakeAgrometeo) FetchStations(context.Context) ([]agrometeo.Station, error) { return f.stations, nil }
func (f *fakeAgrometeo) FetchWeather(context.Context, int) (*agrometeo.WeatherData, error) { return nil, nil }
func (f *fakeAgrometeo) FetchModelGeojson(_ context.Context, modelID int, _ time.Time) ([]agrometeo.ModelFeature, error) {
    return f.features[modelID], nil
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
            if _, ok := seen[p]; !ok { seen[p] = struct{}{}; out = append(out, p) }
        }
    }
    return out, nil
}
func (f *fakePSM) SearchProducts(string, int) ([]domain.PSMProduct, error)   { return nil, nil }
func (f *fakePSM) GetProduct(string) (*domain.PSMProduct, error)             { return nil, nil }
func (f *fakePSM) SearchSubstances(string, int) ([]domain.PSMSubstance, error){ return nil, nil }
func (f *fakePSM) UpsertBatch(domain.PSMBatch) error                          { return nil }
func (f *fakePSM) Meta() (*domain.PSMSyncMeta, error)                         { return nil, nil }
func (f *fakePSM) SetMeta(domain.PSMSyncMeta) error                           { return nil }

type fakePeriods struct{ active map[domain.ProtectionPeriodKind]*domain.ProtectionPeriod }
func (f *fakePeriods) Create(domain.ProtectionPeriod) error { return nil }
func (f *fakePeriods) FindActive(_ uuid.UUID, kind domain.ProtectionPeriodKind) (*domain.ProtectionPeriod, error) {
    return f.active[kind], nil
}
func (f *fakePeriods) CloseLatest(uuid.UUID, domain.ProtectionPeriodKind, uuid.UUID, time.Time) error { return nil }

func TestService_Compute_Sargans_NoMeasures(t *testing.T) {
    vy := &domain.Vineyard{ID: uuid.New(),
        Boundary: &domain.GeoJSON{RawMessage: []byte(`{"type":"Polygon","coordinates":[[[9.45,47.05],[9.46,47.05],[9.46,47.06],[9.45,47.06],[9.45,47.05]]]}`)}}
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
    svc := protection.NewRiskService(vys, agro, &fakeSpray{}, &fakePSM{}, &fakePeriods{}, &agrometeo.Cache{})
    res, err := svc.Compute(context.Background(), vy.ID)
    require.NoError(t, err)
    assert.Equal(t, "SARGANS", res.StationName)
    // mildiou should be rot
    var mildiou *protection.DiseaseResult
    for i := range res.Diseases {
        if res.Diseases[i].Key == "mildiou" { mildiou = &res.Diseases[i] }
    }
    require.NotNil(t, mildiou)
    assert.Equal(t, "rot", mildiou.EffectiveLevel)
}

func ptrInt(i int) *int { return &i }
```

**Hinweis:** Du musst dafür sorgen, dass `fakeAgrometeo` das gleiche Interface erfüllt, das der Service erwartet. Definiere im Service ein Minimal-Interface (nicht das volle `agrometeo.Client`), so dass Tests einfach mocken können.

- [ ] **Step 2: Test ausführen, FAIL erwartet**

Run: `cd apps/backend && go test ./internal/protection/... -run TestService -timeout 30s`
Expected: FAIL — `protection.NewRiskService` existiert nicht.

- [ ] **Step 3: Service implementieren**

```go
// apps/backend/internal/protection/service.go
package protection

import (
    "context"
    "encoding/json"
    "fmt"
    "math"
    "time"

    "github.com/google/uuid"
    "wingert/backend/internal/agrometeo"
    "wingert/backend/internal/domain"
)

type AgrometeoAPI interface {
    FetchStations(ctx context.Context) ([]agrometeo.Station, error)
    FetchModelGeojson(ctx context.Context, modelID int, date time.Time) ([]agrometeo.ModelFeature, error)
}

type RiskService struct {
    vineyards domain.VineyardRepository
    agro      AgrometeoAPI
    sprays    domain.SprayRepository
    psm       domain.PSMRepository
    periods   domain.ProtectionPeriodRepository
    cache     *agrometeo.Cache
}

func NewRiskService(v domain.VineyardRepository, a AgrometeoAPI,
    s domain.SprayRepository, p domain.PSMRepository,
    pp domain.ProtectionPeriodRepository, c *agrometeo.Cache) *RiskService {
    return &RiskService{vineyards: v, agro: a, sprays: s, psm: p, periods: pp, cache: c}
}

type RiskResponse struct {
    VineyardID  uuid.UUID         `json:"vineyardId"`
    StationID   int               `json:"stationId"`
    StationName string            `json:"stationName"`
    FetchedAt   time.Time         `json:"fetchedAt"`
    Phenology   *PhenologyInfo    `json:"phenology,omitempty"`
    Diseases    []DiseaseResult   `json:"diseases"`
}

type PhenologyInfo struct {
    RawIndex float64 `json:"rawIndex"`
    Label    string  `json:"label"`
}

func (s *RiskService) Compute(ctx context.Context, vineyardID uuid.UUID) (*RiskResponse, error) {
    v, err := s.vineyards.GetByID(vineyardID)
    if err != nil || v == nil || v.Boundary == nil {
        return nil, fmt.Errorf("vineyard %s has no boundary", vineyardID)
    }
    lat, lng, err := centroid(v.Boundary)
    if err != nil { return nil, err }

    stations, err := s.agro.FetchStations(ctx)
    if err != nil { return nil, err }
    nearest := agrometeo.NearestStation(stations, lat, lng)

    today := time.Now().UTC().Truncate(24 * time.Hour)
    sprays, err := s.sprays.FindByVineyard(vineyardID, today.AddDate(0, 0, -DefaultSprayProtectionDays*2))
    if err != nil { return nil, err }

    out := &RiskResponse{
        VineyardID: vineyardID, StationID: nearest.ID, StationName: nearest.Name,
        FetchedAt: time.Now(),
    }

    for _, d := range Diseases {
        feats, ok := s.cache.GetModel(d.AgrometeoModelID, today)
        if !ok {
            feats, err = s.agro.FetchModelGeojson(ctx, d.AgrometeoModelID, today)
            if err != nil { return nil, err }
            s.cache.SetModel(d.AgrometeoModelID, today, feats)
        }
        var feature agrometeo.ModelFeature
        for _, f := range feats {
            if f.StationID == nearest.ID { feature = f; break }
        }

        if d.Key == "phenologie" {
            out.Phenology = &PhenologyInfo{
                RawIndex: feature.Index,
                Label:    bbchLabel(int(feature.Index)),
            }
            continue
        }

        relevantSpray := pickRelevantSpray(sprays, d.PSMPestIDs, s.psm)
        var period *domain.ProtectionPeriod
        switch d.Measure {
        case MeasureDispenser:
            period, _ = s.periods.FindActive(vineyardID, domain.ProtectionPeriodDispenser)
        case MeasureMowingPause:
            period, _ = s.periods.FindActive(vineyardID, domain.ProtectionPeriodMowingPause)
        }

        res := Combine(d, feature, relevantSpray, period, time.Now())
        out.Diseases = append(out.Diseases, res)
    }

    sortBySeverity(out.Diseases)
    return out, nil
}

// pickRelevantSpray sucht die jüngste Spritzung, deren Targets eine der diseasePests trifft.
// Wenn TargetPestIDs am Spray leer ist, leitet sie aus SubstanceIDs via PSM ab.
func pickRelevantSpray(sprays []domain.SprayApplication, diseasePests []uuid.UUID, psm domain.PSMRepository) *domain.SprayApplication {
    for i := range sprays {
        targets := sprays[i].TargetPestIDs
        if len(targets) == 0 {
            t, err := psm.GetPestsForSubstances(sprays[i].SubstanceIDs)
            if err == nil { targets = t }
        }
        for _, t := range targets {
            for _, d := range diseasePests {
                if t == d { return &sprays[i] }
            }
        }
    }
    return nil
}

func sortBySeverity(rs []DiseaseResult) {
    rank := map[string]int{"rot": 0, "gelb": 1, "grün": 2, "": 3}
    // simple insertion-style sort (small N=7)
    for i := 1; i < len(rs); i++ {
        for j := i; j > 0; j-- {
            if rank[rs[j].EffectiveLevel] < rank[rs[j-1].EffectiveLevel] {
                rs[j], rs[j-1] = rs[j-1], rs[j]
            } else { break }
        }
    }
}

func centroid(g *domain.GeoJSON) (lat, lng float64, err error) {
    var geom struct {
        Coordinates [][][2]float64 `json:"coordinates"`
    }
    if err = json.Unmarshal(g.RawMessage, &geom); err != nil || len(geom.Coordinates) == 0 {
        return
    }
    ring := geom.Coordinates[0]
    for _, p := range ring {
        lng += p[0]; lat += p[1]
    }
    n := float64(len(ring))
    return lat / n, lng / n, nil
}

func bbchLabel(idx int) string {
    switch {
    case idx == 0:
        return "Keine Daten"
    case idx < 20:
        return "BBCH 09-19 Blattentwicklung"
    case idx < 50:
        return "BBCH 20-49 Triebentwicklung"
    case idx < 60:
        return "BBCH 50-59 Blütenbildung"
    case idx < 70:
        return "BBCH 60-69 Blüte"
    case idx < 80:
        return "BBCH 70-79 Fruchtentwicklung"
    default:
        return fmt.Sprintf("BBCH %d Reife", int(math.Min(89, float64(idx))))
    }
}
```

- [ ] **Step 4: Tests ausführen, PASS erwartet**

Run: `cd apps/backend && go test ./internal/protection/... -timeout 60s -v`
Expected: PASS für alle Service- und Combinator-Tests.

---

### Task 9: Handler `disease.go` + Route

**Files:**
- Create: `apps/backend/internal/handler/disease.go`
- Create: `apps/backend/internal/handler/disease_test.go`
- Modify: `apps/backend/main.go` (Route + Service-Wiring)

- [ ] **Step 1: Handler-Smoke-Test schreiben (mit Stubs)**

Der ausführliche Service-Integration-Test liegt schon in `service_test.go`; hier reicht ein Smoke-Test, der den Handler-Pfad inkl. JSON-Encoding und Routing prüft.

```go
// apps/backend/internal/handler/disease_test.go
package handler_test

import (
    "context"
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

type stubVineyards struct{ v *domain.Vineyard }
func (s *stubVineyards) GetByID(uuid.UUID) (*domain.Vineyard, error) { return s.v, nil }
func (s *stubVineyards) List() ([]domain.Vineyard, error) { return nil, nil }
func (s *stubVineyards) Create(domain.VineyardCreateParams) (*domain.Vineyard, error) { return nil, nil }
func (s *stubVineyards) Update(uuid.UUID, domain.VineyardCreateParams) (*domain.Vineyard, error) { return nil, nil }
func (s *stubVineyards) Delete(uuid.UUID) error { return nil }

type stubAgro struct{}
func (stubAgro) FetchStations(context.Context) ([]agrometeo.Station, error) {
    return []agrometeo.Station{{ID: 138, Name: "SARGANS", Lat: "47.05", Lng: "9.45"}}, nil
}
func (stubAgro) FetchModelGeojson(context.Context, int, time.Time) ([]agrometeo.ModelFeature, error) {
    return []agrometeo.ModelFeature{{StationID: 138, Index: 0}}, nil
}

type stubSprays struct{}
func (stubSprays) Create(domain.SprayApplication) error { return nil }
func (stubSprays) FindByVineyard(uuid.UUID, time.Time) ([]domain.SprayApplication, error) { return nil, nil }

type stubPSM struct{}
func (stubPSM) SearchProducts(string, int) ([]domain.PSMProduct, error)   { return nil, nil }
func (stubPSM) GetProduct(string) (*domain.PSMProduct, error)             { return nil, nil }
func (stubPSM) SearchSubstances(string, int) ([]domain.PSMSubstance, error){ return nil, nil }
func (stubPSM) GetPestsForSubstances([]uuid.UUID) ([]uuid.UUID, error)    { return nil, nil }
func (stubPSM) UpsertBatch(domain.PSMBatch) error                          { return nil }
func (stubPSM) Meta() (*domain.PSMSyncMeta, error)                         { return nil, nil }
func (stubPSM) SetMeta(domain.PSMSyncMeta) error                           { return nil }

type stubPeriods struct{}
func (stubPeriods) Create(domain.ProtectionPeriod) error { return nil }
func (stubPeriods) FindActive(uuid.UUID, domain.ProtectionPeriodKind) (*domain.ProtectionPeriod, error) { return nil, nil }
func (stubPeriods) CloseLatest(uuid.UUID, domain.ProtectionPeriodKind, uuid.UUID, time.Time) error { return nil }

func TestDiseaseRisk(t *testing.T) {
    vy := &domain.Vineyard{ID: uuid.New(),
        Boundary: &domain.GeoJSON{RawMessage: []byte(`{"type":"Polygon","coordinates":[[[9.45,47.05],[9.46,47.05],[9.46,47.06],[9.45,47.06],[9.45,47.05]]]}`)}}
    svc := protection.NewRiskService(&stubVineyards{v: vy}, stubAgro{}, stubSprays{}, stubPSM{}, stubPeriods{}, agrometeo.NewCache())
    h := handler.NewDiseaseHandler(svc)
    r := chi.NewRouter()
    r.Get("/api/vineyards/{id}/disease-risk", h.Get)

    rr := httptest.NewRecorder()
    req := httptest.NewRequest("GET", "/api/vineyards/"+vy.ID.String()+"/disease-risk", nil)
    r.ServeHTTP(rr, req)
    require.Equal(t, http.StatusOK, rr.Code)
    var body struct {
        StationName string                  `json:"stationName"`
        Diseases    []protection.DiseaseResult `json:"diseases"`
    }
    require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &body))
    assert.Equal(t, "SARGANS", body.StationName)
    assert.GreaterOrEqual(t, len(body.Diseases), 6)
}
```

- [ ] **Step 2: Test ausführen, FAIL erwartet**

Run: `cd apps/backend && go test ./internal/handler/... -run TestDiseaseRisk -timeout 30s`
Expected: FAIL — `handler.NewDiseaseHandler` existiert nicht.

- [ ] **Step 3: Handler implementieren**

```go
// apps/backend/internal/handler/disease.go
package handler

import (
    "net/http"

    "github.com/go-chi/chi/v5"
    "github.com/google/uuid"
    "wingert/backend/internal/protection"
)

type DiseaseHandler struct{ svc *protection.RiskService }

func NewDiseaseHandler(svc *protection.RiskService) *DiseaseHandler {
    return &DiseaseHandler{svc: svc}
}

func (h *DiseaseHandler) Get(w http.ResponseWriter, r *http.Request) {
    id, err := uuid.Parse(chi.URLParam(r, "id"))
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid id")
        return
    }
    res, err := h.svc.Compute(r.Context(), id)
    if err != nil {
        writeError(w, http.StatusBadGateway, err.Error())
        return
    }
    writeJSON(w, http.StatusOK, res)
}
```

- [ ] **Step 4: Test ausführen, PASS erwartet**

Run: `cd apps/backend && go test ./internal/handler/... -run TestDiseaseRisk -timeout 30s -v`
Expected: PASS.

---

### Task 10: Handler `psm.go` + Routes

**Files:**
- Create: `apps/backend/internal/handler/psm.go`
- Create: `apps/backend/internal/handler/psm_test.go`

- [ ] **Step 1: Failing Test schreiben**

```go
// apps/backend/internal/handler/psm_test.go
package handler_test

import (
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/go-chi/chi/v5"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    "wingert/backend/internal/domain"
    "wingert/backend/internal/handler"
)

type psmStubWithData struct{ products []domain.PSMProduct }
func (p *psmStubWithData) SearchProducts(q string, _ int) ([]domain.PSMProduct, error) { return p.products, nil }
func (psmStubWithData) GetProduct(string) (*domain.PSMProduct, error) { return nil, nil }
func (psmStubWithData) SearchSubstances(string, int) ([]domain.PSMSubstance, error) { return nil, nil }
func (psmStubWithData) GetPestsForSubstances([]uuid.UUID) ([]uuid.UUID, error)   { return nil, nil }
func (psmStubWithData) UpsertBatch(domain.PSMBatch) error                         { return nil }
func (psmStubWithData) Meta() (*domain.PSMSyncMeta, error)                        { return nil, nil }
func (psmStubWithData) SetMeta(domain.PSMSyncMeta) error                          { return nil }

func TestPSMSearchProducts(t *testing.T) {
    stub := &psmStubWithData{products: []domain.PSMProduct{{ID: "4090", Name: "Aktuan"}}}
    h := handler.NewPSMHandler(stub)
    r := chi.NewRouter()
    r.Get("/api/psm/products", h.SearchProducts)

    rr := httptest.NewRecorder()
    r.ServeHTTP(rr, httptest.NewRequest("GET", "/api/psm/products?q=Akt", nil))
    require.Equal(t, http.StatusOK, rr.Code)
    var body []domain.PSMProduct
    require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &body))
    require.Len(t, body, 1)
    assert.Equal(t, "Aktuan", body[0].Name)
}
```

**Note:** Importiere `github.com/google/uuid` in `psm_test.go`.

- [ ] **Step 2: Test ausführen, FAIL erwartet**

Run: `cd apps/backend && go test ./internal/handler/... -run TestPSMSearchProducts -timeout 30s`
Expected: FAIL.

- [ ] **Step 3: Handler implementieren**

```go
// apps/backend/internal/handler/psm.go
package handler

import (
    "net/http"
    "strconv"

    "github.com/go-chi/chi/v5"
    "wingert/backend/internal/domain"
)

type PSMHandler struct{ repo domain.PSMRepository }

func NewPSMHandler(repo domain.PSMRepository) *PSMHandler {
    return &PSMHandler{repo: repo}
}

func (h *PSMHandler) SearchProducts(w http.ResponseWriter, r *http.Request) {
    q := r.URL.Query().Get("q")
    limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
    items, err := h.repo.SearchProducts(q, limit)
    if err != nil {
        writeInternalError(w, err)
        return
    }
    writeJSON(w, http.StatusOK, items)
}

func (h *PSMHandler) GetProduct(w http.ResponseWriter, r *http.Request) {
    id := chi.URLParam(r, "id")
    p, err := h.repo.GetProduct(id)
    if err != nil {
        writeInternalError(w, err)
        return
    }
    if p == nil {
        writeError(w, http.StatusNotFound, "product not found")
        return
    }
    writeJSON(w, http.StatusOK, p)
}

func (h *PSMHandler) SearchSubstances(w http.ResponseWriter, r *http.Request) {
    q := r.URL.Query().Get("q")
    limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
    items, err := h.repo.SearchSubstances(q, limit)
    if err != nil {
        writeInternalError(w, err)
        return
    }
    writeJSON(w, http.StatusOK, items)
}
```

- [ ] **Step 4: Test ausführen, PASS erwartet**

Run: `cd apps/backend && go test ./internal/handler/... -run TestPSMSearchProducts -timeout 30s -v`
Expected: PASS.

---

### Task 11: Task-Handler-Erweiterung (subtype + spray)

**Files:**
- Modify: `apps/backend/internal/domain/model.go` (Task.Subtype, TaskCreateParams)
- Modify: `apps/backend/internal/store/task.go` (Create persist subtype + spray)
- Modify: `apps/backend/internal/handler/task.go` (decode subtype + spray)
- Create: `apps/backend/internal/handler/task_test.go`

- [ ] **Step 1: Domain-Modell erweitern**

In `apps/backend/internal/domain/model.go` `Task` ergänzen:

```go
type Task struct {
    ID          uuid.UUID    `json:"id"`
    // ... bestehende Felder ...
    Subtype     *string      `json:"subtype,omitempty"`
    Spray       *SprayApplication `json:"spray,omitempty"`
}
```

Und `TaskCreateParams`:

```go
type TaskCreateParams struct {
    // ... bestehende Felder ...
    Subtype *string                 `json:"subtype,omitempty"`
    Spray   *SprayCreateInput       `json:"spray,omitempty"`
}

type SprayCreateInput struct {
    ProductID      *string      `json:"productId,omitempty"`
    SubstanceIDs   []uuid.UUID  `json:"substanceIds"`
    TargetPestIDs  []uuid.UUID  `json:"targetPestIds,omitempty"`
    Dosage         *float64     `json:"dosage,omitempty"`
    DosageUnit     string       `json:"dosageUnit,omitempty"`
    AppliedAt      *time.Time   `json:"appliedAt,omitempty"`
    Notes          string       `json:"notes,omitempty"`
}
```

- [ ] **Step 2: Failing Handler-Test schreiben**

```go
// apps/backend/internal/handler/task_test.go
package handler_test

import (
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/google/uuid"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
    "wingert/backend/internal/handler"
    "wingert/backend/internal/store"
    "wingert/backend/internal/testutil"
)

func TestCreateTask_WithSpray(t *testing.T) {
    db, cleanup := testutil.NewPostgresContainer(t)
    defer cleanup()
    testutil.RunMigrations(t, db)

    // Seed: user, vineyard, psm substance for FK
    userID := uuid.New()
    require.NoError(t, db.Exec(`INSERT INTO users (id,email,name,role,password_hash,created_at)
        VALUES (?, 'a@b','A','admin','x',NOW())`, userID).Error)
    vyID := uuid.New()
    require.NoError(t, db.Exec(`INSERT INTO vineyards (id,name,owner_id,created_at)
        VALUES (?, 'V', ?, NOW())`, vyID, userID).Error)
    sid := uuid.MustParse("683783d6-0b1f-43d4-bf12-209fd6e3c693")
    require.NoError(t, db.Exec(`INSERT INTO psm_substances (id,name_de,synced_at)
        VALUES (?, 'Folpet', NOW())`, sid).Error)

    taskStore := store.NewTaskStore(db)
    sprayStore := store.NewSprayStore(db)
    h := handler.NewTaskHandler(taskStore, sprayStore)

    r := newAuthenticatedRouter(t, db, h) // helper that sets up JWT middleware with seed user
    token := loginAsSeed(t, r)

    body := map[string]any{
        "title": "Spritzung", "recordType": "aufgabe",
        "category": "pflanzenschutz", "subtype": "spritzung",
        "vineyardId": vyID.String(),
        "spray": map[string]any{
            "substanceIds": []string{sid.String()},
            "dosage": 0.125, "dosageUnit": "%",
        },
    }
    rr := httptest.NewRecorder()
    r.ServeHTTP(rr, testutil.JSONRequestWithToken(t, "POST", "/api/tasks", body, token))
    require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())

    var task struct{ ID string `json:"id"`; Subtype string `json:"subtype"` }
    require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &task))
    assert.Equal(t, "spritzung", task.Subtype)

    // verify spray_applications row exists
    var n int64
    require.NoError(t, db.Raw(`SELECT COUNT(*) FROM spray_applications WHERE task_id = ?::uuid`, task.ID).Scan(&n).Error)
    assert.EqualValues(t, 1, n)
}
```

`newAuthenticatedRouter`, `loginAsSeed`, `JSONRequestWithToken` müssen in `testutil` ergänzt werden, falls noch nicht vorhanden. Andernfalls **erst die bestehenden Helper aus `auth_test.go`** kopieren.

- [ ] **Step 3: Test ausführen, FAIL erwartet**

Run: `cd apps/backend && go test ./internal/handler/... -run TestCreateTask_WithSpray -timeout 120s`
Expected: FAIL — `NewTaskHandler` Signatur passt nicht (`sprayStore` neu).

- [ ] **Step 4: TaskHandler-Konstruktor + Create erweitern**

In `apps/backend/internal/handler/task.go`:

```go
type TaskHandler struct {
    repo   domain.TaskRepository
    sprays domain.SprayRepository
}

func NewTaskHandler(repo domain.TaskRepository, sprays domain.SprayRepository) *TaskHandler {
    return &TaskHandler{repo: repo, sprays: sprays}
}

// Erweiterung in Create():
// Decoder um Felder subtype + spray erweitern
//
//   var req struct {
//       Title, RecordType, Category, Notes string
//       Severity, Phase, DueDate *string
//       Location *json.RawMessage
//       VineyardID *string
//       Subtype *string
//       Spray   *struct {
//           ProductID     *string     `json:"productId"`
//           SubstanceIDs  []string    `json:"substanceIds"`
//           TargetPestIDs []string    `json:"targetPestIds"`
//           Dosage        *float64    `json:"dosage"`
//           DosageUnit    string      `json:"dosageUnit"`
//           Notes         string      `json:"notes"`
//       } `json:"spray"`
//   }
```

Vollständiger Diff für `Create`:

```go
func (h *TaskHandler) Create(w http.ResponseWriter, r *http.Request) {
    claims := middleware.ClaimsFromContext(r.Context())
    createdBy, _ := uuid.Parse(claims.UserID)

    var req struct {
        Title      string            `json:"title"`
        RecordType string            `json:"recordType"`
        Category   string            `json:"category"`
        Severity   *string           `json:"severity"`
        Phase      *string           `json:"phase"`
        Notes      string            `json:"notes"`
        DueDate    *string           `json:"dueDate"`
        Location   *json.RawMessage  `json:"location"`
        VineyardID *string           `json:"vineyardId"`
        Subtype    *string           `json:"subtype"`
        Spray      *struct {
            ProductID     *string  `json:"productId"`
            SubstanceIDs  []string `json:"substanceIds"`
            TargetPestIDs []string `json:"targetPestIds"`
            Dosage        *float64 `json:"dosage"`
            DosageUnit    string   `json:"dosageUnit"`
            Notes         string   `json:"notes"`
        } `json:"spray"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        writeError(w, http.StatusBadRequest, "invalid request")
        return
    }
    // ... (bisheriger Mapping-Code für Category, RecordType, Severity, Phase) ...

    p := domain.TaskCreateParams{
        Title:      req.Title,
        RecordType: recordType,
        Category:   category,
        Severity:   severity,
        Phase:      req.Phase,
        Notes:      req.Notes,
        DueDate:    req.DueDate,
        CreatedBy:  createdBy,
        Subtype:    req.Subtype,
    }
    if req.Location != nil {
        p.Location = &domain.GeoJSON{RawMessage: *req.Location}
    }
    if req.VineyardID != nil {
        if id, err := uuid.Parse(*req.VineyardID); err == nil {
            p.VineyardID = &id
        }
    }

    task, err := h.repo.Create(p)
    if err != nil {
        writeInternalError(w, err)
        return
    }

    if req.Spray != nil && req.Subtype != nil && *req.Subtype == "spritzung" {
        substanceIDs := parseUUIDs(req.Spray.SubstanceIDs)
        targets := parseUUIDs(req.Spray.TargetPestIDs)
        if err := h.sprays.Create(domain.SprayApplication{
            TaskID: task.ID, ProductID: req.Spray.ProductID,
            SubstanceIDs: substanceIDs, TargetPestIDs: targets,
            Dosage: req.Spray.Dosage, DosageUnit: req.Spray.DosageUnit,
            AppliedAt: task.CreatedAt, Notes: req.Spray.Notes,
        }); err != nil {
            writeInternalError(w, err)
            return
        }
    }

    writeJSON(w, http.StatusOK, task)
}

func parseUUIDs(in []string) []uuid.UUID {
    out := make([]uuid.UUID, 0, len(in))
    for _, s := range in {
        if u, err := uuid.Parse(s); err == nil {
            out = append(out, u)
        }
    }
    return out
}
```

- [ ] **Step 5: TaskStore.Create um Subtype erweitern**

In `apps/backend/internal/store/task.go` die `taskRow`-Struct um `Subtype` ergänzen und im INSERT mitschreiben:

```go
type taskRow struct {
    // ... bestehende Felder ...
    Subtype     *string             `gorm:"column:subtype"`
}

// In Create():
//   row := taskRow{
//       ...,
//       Subtype: p.Subtype,
//   }
//   if err := s.db.Exec("INSERT INTO tasks (..., subtype) VALUES (..., ?)", ..., p.Subtype).Error; ...
```

Vollständig: in der bestehenden Insert-Anweisung `subtype` als zusätzliche Spalte hinzufügen und `p.Subtype` als zusätzlichen Parameter. Sicherstellen, dass der `loadOne`-Pfad das Feld zurückliest.

- [ ] **Step 6: Tests ausführen, PASS erwartet**

Run: `cd apps/backend && go test ./internal/handler/... -run TestCreateTask -timeout 120s -v`
Expected: PASS.

---

### Task 12: Main-Wiring und Initial-Sync

**Files:**
- Modify: `apps/backend/main.go`

- [ ] **Step 1: Stores und Services in main.go initialisieren**

Nach den bestehenden `*Store := store.New...` ergänzen:

```go
psmStore       := store.NewPSMStore(db)
sprayStore     := store.NewSprayStore(db)
protectionStore := store.NewProtectionPeriodStore(db)

psmSync := psm.NewSyncService(psmStore, psm.DefaultPSMZipURL, protection.RebenCultureID)

riskSvc := protection.NewRiskService(vineyardStore, agroClient, sprayStore, psmStore, protectionStore, agroCache)
```

- [ ] **Step 2: TaskHandler-Aufruf um SprayStore erweitern**

```go
taskH := handler.NewTaskHandler(taskStore, sprayStore)
```

- [ ] **Step 3: Neue Handler instanziieren**

```go
diseaseH := handler.NewDiseaseHandler(riskSvc)
psmH     := handler.NewPSMHandler(psmStore)
```

- [ ] **Step 4: Routes registrieren (innerhalb der `r.Group(func(r chi.Router){ r.Use(jwtMW)` ...)**

```go
r.Get("/api/vineyards/{id}/disease-risk", diseaseH.Get)
r.Get("/api/psm/products",       psmH.SearchProducts)
r.Get("/api/psm/products/{id}",  psmH.GetProduct)
r.Get("/api/psm/substances",     psmH.SearchSubstances)
```

- [ ] **Step 5: Initial-Sync im Hintergrund triggern**

Vor `srv := &http.Server{...}` oder nach Routen-Setup:

```go
go func() {
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
    defer cancel()
    if err := psmSync.Sync(ctx); err != nil {
        log.Printf("psm sync failed: %v", err)
    }
}()
```

Wichtig: importiere `wingert/backend/internal/psm` und `wingert/backend/internal/protection`.

- [ ] **Step 6: Build und Smoketest lokal**

Run: `cd apps/backend && go build ./...`
Expected: ohne Fehler kompilieren.

Run: `cd apps/backend && go vet ./...`
Expected: keine Issues.

Run: `cd apps/backend && go test ./... -timeout 300s`
Expected: alle bestehenden + neuen Tests grün.

---

### Task 13: Frontend — Typen und API

**Files:**
- Modify: `apps/frontend/src/types/index.ts`
- Create: `apps/frontend/src/api/protection.ts`
- Create: `apps/frontend/src/api/psm.ts`
- Modify: `apps/frontend/src/api/weather.ts`

- [ ] **Step 1: Typen ergänzen**

In `apps/frontend/src/types/index.ts` am Ende des Datei-Blocks für PlantProtection ergänzen:

```ts
export type DiseaseLevel = 'grün' | 'gelb' | 'rot' | ''
export type MeasureKind = 'spray' | 'dispenser' | 'mowing-pause' | ''
export type TaskSubtype =
  | 'spritzung'
  | 'dispenser-haengen' | 'dispenser-entfernen'
  | 'mahd-pause-start' | 'mahd-pause-ende'

export interface DiseaseResult {
  key: string
  name: string
  modelID: number
  rawIndex: number
  rawLevel: DiseaseLevel
  effectiveIndex: number
  effectiveLevel: DiseaseLevel
  measureType: MeasureKind
  lastMeasureAt?: string
  recommendation?: string
}

export interface DiseaseRiskResponse {
  vineyardId: string
  stationId: number
  stationName: string
  fetchedAt: string
  phenology?: { rawIndex: number; label: string }
  diseases: DiseaseResult[]
}

export interface PsmSubstance {
  id: string
  nameDe: string
}

export interface PsmIndication {
  id: number
  productId: string
  pestId: string
  pestName?: string
  dosageFrom?: number
  dosageTo?: number
  dosageUnit?: string
  waitingPeriodDays?: number
}

export interface PsmProduct {
  id: string
  wNbr: string
  name: string
  isParallelImport?: boolean
  substances?: PsmSubstance[]
  indications?: PsmIndication[]
}

export interface SprayPayload {
  productId?: string
  substanceIds: string[]
  targetPestIds?: string[]
  dosage?: number
  dosageUnit?: string
  notes?: string
}
```

- [ ] **Step 2: `api/protection.ts` schreiben**

```ts
// apps/frontend/src/api/protection.ts
import type { DiseaseRiskResponse } from '../types'

export async function getDiseaseRisk(vineyardId: string): Promise<DiseaseRiskResponse> {
  const res = await fetch(`/api/vineyards/${vineyardId}/disease-risk`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  })
  if (!res.ok) throw new Error('Krankheitsrisiko konnte nicht geladen werden')
  return res.json()
}
```

- [ ] **Step 3: `api/psm.ts` schreiben**

```ts
// apps/frontend/src/api/psm.ts
import type { PsmProduct, PsmSubstance } from '../types'

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

export async function searchProducts(q: string, limit = 20): Promise<PsmProduct[]> {
  const res = await fetch(`/api/psm/products?q=${encodeURIComponent(q)}&limit=${limit}`,
    { headers: auth() })
  if (!res.ok) throw new Error('Produkte konnten nicht geladen werden')
  return res.json()
}

export async function getProduct(id: string): Promise<PsmProduct> {
  const res = await fetch(`/api/psm/products/${encodeURIComponent(id)}`, { headers: auth() })
  if (!res.ok) throw new Error('Produkt konnte nicht geladen werden')
  return res.json()
}

export async function searchSubstances(q: string, limit = 20): Promise<PsmSubstance[]> {
  const res = await fetch(`/api/psm/substances?q=${encodeURIComponent(q)}&limit=${limit}`, { headers: auth() })
  if (!res.ok) throw new Error('Wirkstoffe konnten nicht geladen werden')
  return res.json()
}
```

- [ ] **Step 4: `api/weather.ts` umbauen (Worst-Of)**

```ts
// apps/frontend/src/api/weather.ts
import type { WeatherData, PlantProtectionStatus } from '../types'
import { getDiseaseRisk } from './protection'

export async function getWeather(vineyardId: string): Promise<WeatherData> {
  const res = await fetch(`/api/vineyards/${vineyardId}/weather`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  })
  if (!res.ok) throw new Error('Wetterdaten konnten nicht geladen werden')
  return res.json()
}

const AGGREGATE_KEYS = new Set(['mildiou', 'oidium', 'black-rot', 'botrytis', 'acariose'])

export async function getProtectionStatus(vineyardId: string): Promise<PlantProtectionStatus> {
  const risk = await getDiseaseRisk(vineyardId)
  const relevant = risk.diseases.filter((d) => AGGREGATE_KEYS.has(d.key))
  const rank = { rot: 0, gelb: 1, grün: 2, '': 3 } as const
  const worst = relevant.sort((a, b) => rank[a.effectiveLevel] - rank[b.effectiveLevel])[0]

  let lastSprayDate: string | null = null
  let daysSinceSpray: number | null = null
  for (const d of risk.diseases) {
    if (d.measureType === 'spray' && d.lastMeasureAt) {
      const sprayDate = new Date(d.lastMeasureAt)
      if (!lastSprayDate || sprayDate > new Date(lastSprayDate)) {
        lastSprayDate = d.lastMeasureAt.slice(0, 10)
        daysSinceSpray = Math.round((Date.now() - sprayDate.getTime()) / 86400000)
      }
    }
  }

  return {
    lastSprayDate,
    daysSinceSpray,
    protectionPct: daysSinceSpray !== null ? Math.max(0, 100 - Math.round((daysSinceSpray / 12) * 100)) : 0,
    level: (worst?.effectiveLevel || 'rot') as PlantProtectionStatus['level'],
  }
}
```

- [ ] **Step 5: Frontend kompilieren**

Run: `cd apps/frontend && pnpm lint`
Expected: kein TypeScript-Fehler.

---

### Task 14: Frontend — SprayFields und TaskForm-Integration

**Files:**
- Create: `apps/frontend/src/components/Tasks/SprayFields.tsx`
- Create: `apps/frontend/src/components/Tasks/SprayFields.test.tsx`
- Modify: `apps/frontend/src/components/Tasks/TaskForm.tsx`

- [ ] **Step 1: SprayFields-Komponente schreiben**

```tsx
// apps/frontend/src/components/Tasks/SprayFields.tsx
import { useEffect, useState } from 'react'
import {
  Autocomplete, Box, Chip, TextField, Typography,
} from '@mui/material'
import type { PsmProduct, SprayPayload } from '../../types'
import { getProduct, searchProducts } from '../../api/psm'

interface Props {
  value: SprayPayload
  onChange: (next: SprayPayload) => void
}

export default function SprayFields({ value, onChange }: Props) {
  const [options, setOptions] = useState<PsmProduct[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<PsmProduct | null>(null)

  useEffect(() => {
    if (query.length < 2) { setOptions([]); return }
    let cancelled = false
    searchProducts(query).then((p) => { if (!cancelled) setOptions(p) }).catch(() => {})
    return () => { cancelled = true }
  }, [query])

  async function pick(p: PsmProduct | null) {
    setSelected(p)
    if (!p) {
      onChange({ ...value, productId: undefined, substanceIds: [], targetPestIds: undefined })
      return
    }
    const full = await getProduct(p.id)
    const substanceIds = (full.substances ?? []).map((s) => s.id)
    const targetPestIds = Array.from(new Set((full.indications ?? []).map((i) => i.pestId)))
    setSelected(full)
    onChange({ ...value, productId: full.id, substanceIds, targetPestIds })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Autocomplete
        options={options}
        getOptionLabel={(o) => o.name}
        filterOptions={(x) => x}
        onInputChange={(_, v) => setQuery(v)}
        onChange={(_, v) => pick(v)}
        renderInput={(params) => <TextField {...params} label="Produkt" size="small" placeholder="Aktuan, Folpan, …" />}
      />
      {selected?.substances && (
        <Box>
          <Typography variant="caption" color="text.secondary">Wirkstoffe</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
            {selected.substances.map((s) => (
              <Chip key={s.id} label={s.nameDe} size="small" />
            ))}
          </Box>
        </Box>
      )}
      {selected?.indications && selected.indications.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary">Wirkt gegen</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
            {selected.indications.map((i) => (
              <Chip key={i.id} label={i.pestName ?? i.pestId} size="small" color="success" />
            ))}
          </Box>
        </Box>
      )}
      <TextField
        label="Dosierung"
        type="number"
        size="small"
        inputProps={{ step: 0.001 }}
        value={value.dosage ?? ''}
        onChange={(e) => onChange({ ...value, dosage: e.target.value ? Number(e.target.value) : undefined })}
        helperText={selected?.indications?.[0]?.dosageFrom != null ? `Empfohlen: ${selected.indications[0].dosageFrom} ${selected.indications[0].dosageUnit ?? ''}` : ''}
      />
    </Box>
  )
}
```

- [ ] **Step 2: SprayFields-Test schreiben**

```tsx
// apps/frontend/src/components/Tasks/SprayFields.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import SprayFields from './SprayFields'
import * as psmApi from '../../api/psm'

vi.mock('../../api/psm')

describe('SprayFields', () => {
  beforeEach(() => vi.resetAllMocks())

  it('loads product details on pick and emits payload', async () => {
    vi.mocked(psmApi.searchProducts).mockResolvedValue([{ id: '4090', wNbr: 'W-4090', name: 'Aktuan' }])
    vi.mocked(psmApi.getProduct).mockResolvedValue({
      id: '4090', wNbr: 'W-4090', name: 'Aktuan',
      substances: [{ id: 's1', nameDe: 'Folpet' }],
      indications: [{ id: 1, productId: '4090', pestId: 'p1', pestName: 'Falscher Mehltau' }],
    })
    const onChange = vi.fn()
    render(<SprayFields value={{ substanceIds: [] }} onChange={onChange} />)
    const u = userEvent.setup()
    await u.click(screen.getByLabelText(/Produkt/i))
    await u.keyboard('Akt')
    const option = await screen.findByText('Aktuan')
    await u.click(option)
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      productId: '4090',
      substanceIds: ['s1'],
      targetPestIds: ['p1'],
    })))
  })
})
```

- [ ] **Step 3: Test ausführen, FAIL erwartet**

Run: `cd apps/frontend && pnpm test SprayFields`
Expected: FAIL — Komponente nicht in render-Pfad eingebunden.

Wenn der Test bei `searchProducts` `loadOptions`-Timing scheitert: in der Komponente die `if (query.length < 2)`-Schwelle für Tests anpassen oder `userEvent.type` länger machen. Akzeptierbar wäre auch, in den Tests `searchProducts` direkt nach `setQuery('Akt')` und einer kleinen Wartephase mit `waitFor` einzubinden.

- [ ] **Step 4: Test laufen lassen, PASS erwartet**

Run: `cd apps/frontend && pnpm test SprayFields -- --run`
Expected: PASS.

- [ ] **Step 5: TaskForm um Subtype + SprayFields erweitern**

In `apps/frontend/src/components/Tasks/TaskForm.tsx`:

1. Neue State-Variablen:
   ```tsx
   const [subtype, setSubtype] = useState<TaskSubtype | ''>('')
   const [spray, setSpray] = useState<SprayPayload>({ substanceIds: [] })
   ```

2. Subtype-Selector unterhalb des `pflanzenschutz`-Pfads im Beobachtung-Zweig einblenden (oder neu: bei Aufgabe + Kategorie pflanzenschutz). Im Aufgaben-Zweig ergänzen:

   ```tsx
   {recordType === 'aufgabe' && /* Tätigkeit-Auswahl liefert Kategorie 'pflanzenschutz'? */
     selectedWorkTypeIsPflanzenschutz && (
     <FormControl size={inputSize}>
       <InputLabel>Massnahmen-Typ</InputLabel>
       <Select value={subtype} onChange={(e) => setSubtype(e.target.value as TaskSubtype)}>
         <MenuItem value="spritzung">Spritzung</MenuItem>
         <MenuItem value="dispenser-haengen">Dispenser aufhängen</MenuItem>
         <MenuItem value="dispenser-entfernen">Dispenser entfernen</MenuItem>
         <MenuItem value="mahd-pause-start">Mahd-Pause starten</MenuItem>
         <MenuItem value="mahd-pause-ende">Mahd-Pause beenden</MenuItem>
       </Select>
     </FormControl>
   )}
   {subtype === 'spritzung' && <SprayFields value={spray} onChange={setSpray} />}
   ```

   **Wichtig:** Die Logik "Aufgabe ist Pflanzenschutz" muss im aktuellen Formular ergänzt werden. Im aktuellen Code hat eine "Aufgabe" immer Kategorie `'sonstiges'`; wir erweitern: wenn der gewählte `workType.name === 'Pflanzenschutz'` (bzw. ein passender Marker), setzen wir Category auf `pflanzenschutz` und zeigen die Subtype-Auswahl. Implementation:

   ```tsx
   const wt = workTypes.find((w) => w.id === selectedWorkTypeId)
   const isPflanzenschutz = wt?.name.toLowerCase().includes('pflanzenschutz') ?? false
   ```

3. Im `onSubmit`-Body `subtype` und `spray` mitschicken:

   ```tsx
   const task = await onSubmit({
     // ... bestehend ...
     category: isPflanzenschutz ? 'pflanzenschutz' : 'sonstiges',
     subtype: subtype || undefined,
     spray: subtype === 'spritzung' ? spray : undefined,
   })
   ```

4. Den Props-Typ von `onSubmit` entsprechend erweitern:

   ```tsx
   onSubmit: (params: {
     // ... bestehend ...
     subtype?: TaskSubtype
     spray?: SprayPayload
   }) => Promise<Task>
   ```

5. Den Aufrufer (`apps/frontend/src/api/tasks.ts` oder wo immer der Task POST gesendet wird) anpassen, damit `subtype` und `spray` durchgereicht werden.

- [ ] **Step 6: Frontend smoke-testen**

Run: `cd apps/frontend && pnpm test -- --run`
Expected: alle Frontend-Tests grün.

Run: `cd apps/frontend && pnpm lint`
Expected: kein TS-Fehler.

---

### Task 15: ProtectionBadge auf Worst-Of umstellen

**Files:**
- Modify: `apps/frontend/src/components/Vineyard/ProtectionBadge.tsx`

- [ ] **Step 1: Komponente anpassen — Tooltip erweitern**

Da `getProtectionStatus` jetzt intern `getDiseaseRisk` aufruft und Worst-Of zurückgibt, funktioniert die Komponente schon. Aber wir wollen mehr Info zeigen: Im Tooltip die einzelnen Krankheits-Levels listen.

```tsx
// apps/frontend/src/components/Vineyard/ProtectionBadge.tsx
import { useEffect, useState } from 'react'
import { Box, Chip, Skeleton, Tooltip, Typography } from '@mui/material'
import type { DiseaseRiskResponse } from '../../types'
import { getDiseaseRisk } from '../../api/protection'

interface Props { vineyardId: string }

const LEVEL_CHIP_COLOR = { grün: 'success', gelb: 'warning', rot: 'error' } as const
const LEVEL_ICON: Record<string, string> = { grün: '🟢', gelb: '🟡', rot: '🔴' }

const AGGREGATE_KEYS = new Set(['mildiou', 'oidium', 'black-rot', 'botrytis', 'acariose'])

export default function ProtectionBadge({ vineyardId }: Props) {
  const [data, setData] = useState<DiseaseRiskResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDiseaseRisk(vineyardId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [vineyardId])

  if (loading) return <Skeleton variant="rounded" width={180} height={28} />
  if (!data) {
    return <Chip label="Pflanzenschutz: kein Eintrag" size="small"
      sx={{ bgcolor: 'action.hover', color: 'text.secondary' }} />
  }

  const relevant = data.diseases.filter((d) => AGGREGATE_KEYS.has(d.key))
  const rank = { rot: 0, gelb: 1, grün: 2, '': 3 } as const
  const worst = [...relevant].sort((a, b) => rank[a.effectiveLevel] - rank[b.effectiveLevel])[0]
  const level = worst?.effectiveLevel || 'grün'
  const icon = LEVEL_ICON[level] ?? '⚪'
  const chipColor = LEVEL_CHIP_COLOR[level as keyof typeof LEVEL_CHIP_COLOR] ?? 'default'

  return (
    <Tooltip
      arrow
      title={
        <Box>
          <Typography variant="caption" component="p">Station: {data.stationName}</Typography>
          {relevant.map((d) => (
            <Typography key={d.key} variant="caption" component="p">
              {LEVEL_ICON[d.effectiveLevel] ?? '⚪'} {d.name}
            </Typography>
          ))}
        </Box>
      }
    >
      <Chip label={`${icon} Pflanzenschutz`} size="small" color={chipColor} sx={{ fontWeight: 500 }} />
    </Tooltip>
  )
}
```

- [ ] **Step 2: Bestehenden Test (falls vorhanden) prüfen + manuelles Smoketest**

Run: `cd apps/frontend && pnpm test -- --run`
Expected: PASS.

Run: `cd apps/frontend && pnpm dev` und im Browser eine Vineyard-Liste öffnen — Tooltip muss Krankheits-Übersicht zeigen.

- [ ] **Step 3: Build prüfen**

Run: `cd apps/frontend && pnpm build`
Expected: kein TS- oder Build-Fehler.

---

## Self-Review

Nach dem Schreiben des Plans gegen die Spec geprüft:

**Spec-Coverage:**
- §4.1 Agrometeo API → Task 6
- §4.2 BLV XML → Tasks 3, 4
- §4.3 Mapping → Task 7 (Konstanten in `protection.Config`)
- §5.1 Neue Tabellen → Task 1
- §5.2 Task-Erweiterung → Task 1 (DDL) + Task 11 (Handler)
- §5.3 Konfigurations-Konstanten → Task 7
- §6 Domänenlogik (Combinator) → Task 7
- §6.4 Worst-Of → Task 13 (Frontend `getProtectionStatus`) + Task 15
- §7.1 Disease Risk Endpoint → Tasks 8 (Service) + 9 (Handler)
- §7.2 Detail Trend/Forecast → **Stufe 3** (nicht in diesem Plan)
- §7.3 PSM-Lookup → Task 10
- §7.4 Spritzung erfassen → Task 11
- §7.5 Dispenser / Mahd-Pause → **Stufe 2** (Subtype existiert, Combinator-Logik vorhanden, aber Auto-Period-Creation fehlt bewusst)
- §7.6 PSM-Sync (Admin-Trigger) → Initial-Sync in Task 12; manuell triggerbar via separater Admin-Endpoint **Stufe 2**
- §8.1 Package-Layout → entspricht 1:1
- §8.2 Sync-Service-Flow → Task 4
- §9 Frontend → Tasks 13, 14, 15 (ohne Pflanzenschutz-Panel = **Stufe 2**)

**Bewusst NICHT in Stufe 1 (kommen in Stufe 2/3):**
- Pflanzenschutz-Panel im Frontend (Kachel-Grid)
- protection_periods Auto-Create bei Dispenser-/Mahd-Pause-Tasks
- Detail-Modal mit Trend/Forecast
- Admin-Endpoint POST /api/admin/psm-sync (Initial-Sync läuft in Task 12 beim Start)
- Cron-Job (Initial-Sync deckt den Bootstrap; periodisch in Stufe 2)

**Placeholder/Konsistenz-Check:** keine TBD/TODO/FIXME. Methodensignaturen `Combine(...)`, `NewRiskService(...)`, `Compute(...)`, `Create(...)` durchgängig konsistent. UUIDs lower-case (Go `uuid.Parse` ist case-insensitive, aber Konsistenz erleichtert Diffs).

**Risiken in diesem Plan:**
- Echte BLV-XML-Datei wird in CI nicht heruntergeladen; Initial-Sync läuft beim ersten Start gegen die echte URL. In Tests gibt es nur Fixture.
- TaskForm-Erweiterung (Task 14 Step 5) ist die UI-intensivste Stelle — wenn die Tätigkeits-Logik anders strukturiert ist als hier angenommen, gegebenenfalls in der Bestandsdatei umstellen, nicht hier blockieren.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-13-pflanzenschutz-ampel-stufe1.md`. Zwei Execution-Optionen:

1. **Subagent-Driven (empfohlen)** — frischer Subagent pro Task, Review zwischen Tasks, schnelle Iteration
2. **Inline Execution** — Tasks in dieser Session ausführen mit `superpowers:executing-plans`, Batch mit Checkpoints

Welche Variante?
