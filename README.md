# Wingertmap

Weinberg-Verwaltungsapp: Karte (Swisstopo WMTS), Wingerte/Reihen/Reben verwalten, Aufgaben im Feld.

## Architektur

```
wingertmap/
├── apps/
│   ├── backend/        Go · Chi · GORM · PostgreSQL+PostGIS · JWT
│   └── frontend/       React · TypeScript · Vite · MUI · Leaflet · Zustand
├── charts/wingert/     Helm Chart (Postgres, Backend, Frontend)
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

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| POST | `/api/auth/register` | Registrierung |
| POST | `/api/auth/login` | Login → JWT |
| GET | `/api/auth/me` | Eigenes Profil |
| GET/POST | `/api/vineyards` | Wingerte |
| GET/PUT/DELETE | `/api/vineyards/:id` | Wingert Detail |
| GET/POST | `/api/vineyards/:id/rows` | Reihen |
| GET/POST | `/api/rows/:id/vines` | Reben |
| GET | `/api/vines/nearby?lat=&lng=&radius=` | GPS-Suche |
| GET/POST | `/api/vines/:id/tasks` | Aufgaben |
| PATCH | `/api/tasks/:id/status` | Status ändern |
| POST | `/api/vineyards/:id/drone-images` | Drohnenbild hochladen |

## Deployment

```bash
helm upgrade --install wingert ./charts/wingert \
  -f charts/wingert/values.yaml \
  -f charts/wingert/values.prod.yaml \
  --set backend.env.JWT_SECRET="$JWT_SECRET" \
  --set postgres.env.POSTGRES_PASSWORD="$DB_PASSWORD"
```

CI läuft via GitHub Actions (`.github/workflows/ci.yaml`). Bei Merge auf `main` werden Docker-Images gebaut und nach GHCR gepusht.
