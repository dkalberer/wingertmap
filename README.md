# Wingertmap

Weinberg-Verwaltungsapp: Karte (Swisstopo WMTS), Wingerte/Reihen/Reben verwalten, Aufgaben im Feld, modellbasierte Pflanzenschutz-Ampel (Agrometeo + BLV-PSM-Register).

## Features

- **Karte** mit Swisstopo WMTS, Vineyard-Polygone, Reihen, Reben mit GPS-Suche
- **Aufgaben & Beobachtungen** pro Rebe oder geo-referenziert
- **Personal & Stundenrapport** mit Monatsstatistiken
- **Lese/Reife-Tagebuch** und Schnittarten-Erfassung
- **Pflanzenschutz-Ampel** pro Krankheit (Mildiou, Oïdium, Black Rot, Botrytis, Acariose, Bois Noir, Traubenwickler) mit Wetterdaten von Agrometeo und automatischer Wirkstoff-Ableitung aus dem BLV-PSM-Register

## Architektur

```
wingertmap/
├── apps/
│   ├── backend/        Go · Chi · GORM · PostgreSQL+PostGIS · JWT
│   └── frontend/       React · TypeScript · Vite · MUI · Leaflet · Recharts · Zustand
├── charts/wingert/     Helm Chart (Postgres, Backend, Frontend)
├── docs/superpowers/   Specs & Implementation-Pläne
└── scripts/            setup-local.sh, port-forward.sh, run-ci.sh
```

## Voraussetzungen

- Go 1.26+
- Node 22+ mit pnpm
- Docker Desktop
- kind, kubectl, helm, task

## Lokales Setup (einmalig)

```bash
task setup      # kind-Cluster erstellen + ingress-nginx installieren
task build      # Docker-Images bauen
task deploy     # Helm-Release installieren
task load       # Images in kind laden + Pods neu starten
task forward    # Port-Forwards starten
```

Danach: [http://localhost:3000](http://localhost:3000)

## Entwicklung

```bash
task test       # Alle Tests (Backend + Frontend)
task lint       # Linting (go vet + tsc)
task ci         # Lokale CI-Pipeline (wie GitHub Actions)
```

### Nur Frontend

```bash
cd apps/frontend
pnpm install
pnpm dev        # Vite Dev-Server auf :5173
pnpm test       # Vitest (MSW, kein Backend nötig)
```

### Nur Backend

```bash
cd apps/backend
go test ./... -timeout 300s   # benötigt Docker (testcontainers)
go run .                       # Server auf :8080
```

## API-Übersicht

### Auth & Stammdaten

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| POST | `/api/auth/register` | Registrierung |
| POST | `/api/auth/login` | Login → JWT |
| GET | `/api/auth/me` | Eigenes Profil |
| POST | `/api/auth/change-password` | Passwort ändern |
| GET/POST | `/api/vineyards` | Wingerte |
| GET/PUT/DELETE | `/api/vineyards/:id` | Wingert Detail |
| GET/POST | `/api/vineyards/:id/rows` | Reihen |
| GET/POST | `/api/rows/:id/vines` | Reben |
| GET | `/api/vines/nearby?lat=&lng=&radius=` | GPS-Suche |
| GET/POST | `/api/vines/:id/tasks` | Aufgaben pro Rebe |
| GET/POST | `/api/tasks` | Globaler Task-Index + Erfassen |
| PATCH | `/api/tasks/:id/status` | Status ändern |
| GET/POST | `/api/tasks/:id/photos` | Aufgaben-Fotos |
| GET/POST | `/api/varieties` | Rebsorten |
| GET/POST | `/api/vineyards/:id/harvests` | Lese-Tagebuch |
| GET/POST | `/api/vineyards/:id/pruning` | Schnitt-Erfassung |
| GET/POST | `/api/vineyards/:id/journals` | Jahres-Tagebuch |

### Personal & Stundenrapport

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| GET/POST | `/api/employees` | Mitarbeitende |
| GET/POST | `/api/work-types` | Tätigkeits-Kategorien |
| GET/POST | `/api/time-entries` | Stunden-Einträge |
| GET | `/api/time-entries/stats?year=` | Monatsstatistik |
| GET | `/api/time-entries/export?year=&format=csv` | CSV-Export |

### Wetter & Pflanzenschutz

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| GET | `/api/vineyards/:id/weather` | 24h-Wetter (Agrometeo nächste Station) |
| GET | `/api/vineyards/:id/disease-risk` | Risiko pro Krankheit (raw + effective) |
| GET | `/api/vineyards/:id/disease-risk/:key/series?from=&to=` | Tages-Zeitreihe für Detail-Chart |
| GET | `/api/vineyards/:id/plant-protection-status` | Worst-Of-Ampel (für Karten-Übersicht) |
| GET | `/api/psm/products?q=&limit=` | Produkt-Suche im BLV-PSM-Register |
| GET | `/api/psm/products/:id` | Produkt-Details (Wirkstoffe, Indikationen, Wartefrist) |
| GET | `/api/psm/substances?q=&limit=` | Wirkstoff-Suche |

## Pflanzenschutz-Ampel

Die Ampel kombiniert offizielle Modelldaten von **Agrometeo (Agroscope)** mit dem **BLV-PSM-Register** und den eigenen Erfassungen im Spritz-Tagebuch.

- 8 Krankheitsmodelle: Falscher Mehltau (Plasmopara), Echter Mehltau (Oïdium), Black Rot, Botrytis, Acariose, Bois Noir, Traubenwickler, Phänologie
- Beim Erfassen einer Spritzung wählt man ein Produkt aus dem BLV-Register; Wirkstoffe und abgedeckte Krankheiten werden automatisch abgeleitet
- Schutzdauer aktuell pauschal 12 Tage; Combinator skaliert die effektive Ampel mit `(1 − days_since_spray / 12)`
- Pheromon-Dispenser und Mahd-Pausen (gegen Bois Noir) werden als saisonale Schutzperioden erfasst — die Ampel ist grün, solange die Periode offen ist
- Detail-Modal pro Krankheit mit 12-Tage-Trend, 5-Tage-Forecast und Massnahmen-Timeline
- PSM-Daten werden via `psm.Scheduler` wöchentlich aktualisiert

Design-Doku: [`docs/superpowers/specs/2026-05-13-pflanzenschutz-ampel-design.md`](docs/superpowers/specs/2026-05-13-pflanzenschutz-ampel-design.md)
Offene Ideen: [`.docs/BACKLOG.md`](.docs/BACKLOG.md)

## Deployment

```bash
helm upgrade --install wingert ./charts/wingert \
  -f charts/wingert/values.yaml \
  -f charts/wingert/values.prod.yaml \
  --set backend.env.JWT_SECRET="$JWT_SECRET" \
  --set postgres.env.POSTGRES_PASSWORD="$DB_PASSWORD"
```

CI läuft via GitHub Actions (`.github/workflows/ci.yaml`). Bei Merge auf `main` werden Docker-Images gebaut und nach GHCR gepusht.
