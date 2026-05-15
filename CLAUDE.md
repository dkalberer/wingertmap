# Claude Code — Repo Notes

Read first, then act. These rules override conflicting defaults from any skill.

## Workflow

- **Never commit, stage, or push without an explicit user instruction.** Leave changes in the working tree. The user reviews and commits manually. This applies even when a skill says "commit your work".
- **Don't create git worktrees** — work directly in the main checkout.
- **Don't pin specific versions** (Go, Node, library X) when writing plans/specs unless the user asks; keep it flexible.
- **TDD where it pays off** — table-driven Go tests, vitest specs for React components. Don't TDD trivial passthrough handlers.
- **Subagent-driven development** is the default execution mode when there's a written plan. Spec + plan live under `docs/superpowers/specs/` and `docs/superpowers/plans/`.

## Layout

```
apps/backend/        Go module — Chi router, GORM (raw SQL), PostgreSQL+PostGIS
apps/frontend/       React 18 + TS + Vite + MUI v6/v7 + Recharts + Leaflet + Zustand
charts/wingert/      Helm chart (Postgres, Backend, Frontend)
scripts/             setup-local.sh, port-forward.sh, run-ci.sh
docs/superpowers/    specs/ und plans/ aus Brainstorming/Planning-Skills
.docs/BACKLOG.md     Feature-Ideen
```

## Backend conventions

- `internal/domain/*` — Entity-Typen und Repository-Interfaces
- `internal/store/*` — GORM `db.Raw().Scan()` und `db.Exec()`, kein ORM-Autobuild. Pattern: `type XxxStore struct{ db *gorm.DB }` + `NewXxxStore(db)` constructor
- `internal/handler/*` — Chi-Handler, response helpers in `respond.go` (`writeJSON`, `writeError`, `writeInternalError`)
- `internal/handler/middleware/jwt.go` — JWT-Middleware (`NewJWT(secret)`) und `ClaimsFromContext`
- `internal/platform/` — Config, DB-Init, Migrations
- Tests laufen gegen ein Postgres-Testcontainer (Docker erforderlich), siehe `internal/testutil/db.go`
- `migrations/NNN_*.sql` — sequenzielle SQL-Files, von `platform.RunMigrations` und `testutil.RunMigrations` in Dateinamen-Reihenfolge ausgeführt. Pattern: `CREATE TABLE IF NOT EXISTS`, FK `ON DELETE CASCADE` für Besitz-Beziehungen, `idx_<table>_<column>` für Indices.
- `lib/pq.Array(...)` für UUID-Arrays binden; scannen direkt in `[]uuid.UUID` funktioniert mit dem GORM-Postgres-Treiber.

## Frontend conventions

- Komponenten unter `src/components/<Domain>/`, Files PascalCase
- Tests `*.test.tsx` neben der Komponente (Vitest + Testing Library)
- API-Helper unter `src/api/<domain>.ts`, Auth via `Authorization: Bearer ${localStorage.getItem('token')}`
- `src/types/index.ts` ist die Quelle aller geteilten Typen
- MUI Grid v2 Syntax: `<Grid size={{ xs: 12, sm: 6, md: 4 }}>`
- `src/setupTests.ts` startet MSW; `onUnhandledRequest: 'error'` — fremde Requests in Tests müssen gemockt werden
- Recharts in jsdom braucht den ResizeObserver-Polyfill in `setupTests.ts` (bereits drin)

## External integrations

- **Agrometeo** (`api.agrometeo.ch`): keine Auth. Endpoints: `/api/stations`, `/api/meteo/stations/{id}/data`, `/api/models/{modelId}/geojson?date=YYYY-MM-DD`. Cache in `internal/agrometeo/cache.go`, TTLs: heute/Forecast 30 min, Vergangenheit 24 h.
- **BLV PSM-Register** (`blv.admin.ch`): offizielles XML (8 MB ZIP, 62 MB XML), monatlich. Streaming-Parser in `internal/psm/xml.go`. Periodischer Sync via `internal/psm/scheduler.go` (7 Tage).

## Test commands

```bash
# Backend (Docker erforderlich für testcontainers)
cd apps/backend && go test ./... -timeout 300s

# Nur non-Docker Packages (lokale Entwicklung)
cd apps/backend && go test ./internal/agrometeo/... ./internal/protection/... ./internal/psm/... -timeout 60s

# Frontend
cd apps/frontend && pnpm test -- --run
cd apps/frontend && pnpm lint   # tsc --noEmit
cd apps/frontend && pnpm build
```

## Spec/plan workflow

1. Brainstorming → Spec unter `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
2. Plan unter `docs/superpowers/plans/YYYY-MM-DD-<topic>-stufeN.md` (mehrere Stufen pro Feature OK)
3. Subagent-Driven Execution mit Spec- und Code-Quality-Review pro Task
4. Werden Tests/Build grün → Status berichten, User committet manuell

## Heuristics that matter here

- **Reben-Kultur-ID** auf psm.admin.ch: `2314eb9f-7207-409f-a0d4-89b6a1177363` (Konstante in `protection.RebenCultureID`)
- **Agrometeo-Stations**: ~150 Stück. `agrometeo.NearestStation(stations, lat, lng)` via Haversine. Vineyards mit `Boundary == nil` haben kein Risiko-Resultat.
- **Pflanzenschutz-Subtypes**: `spritzung`, `dispenser-haengen`, `dispenser-entfernen`, `mahd-pause-start`, `mahd-pause-ende`. Nicht-spritzung-Subtypen triggern Auto-Periode via `protection.PeriodWriter`.
