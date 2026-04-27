# Wingertmap – Feature Backlog

Stand: 2026-04-24

---

## 1. Pflanzenschutz-Ampel (Krankheitsmodell)

**Ziel:** Echte Peronospora/Oidium-Risikoberechnung via Agrometeo-Krankheitsmodelle, kombiniert mit eigenem Spritztagebuch.

Aktuell ist nur ein vereinfachter Status basierend auf `days_since_spray` implementiert. Noch fehlend:

- Anbindung an VitiMeteo Plasmopara und VitiMeteo Oidium (Agrometeo API)
- Getrennte Ampeln für Peronospora und Oidium
- Risikoformel:
  ```
  protection = max(0, 1 - days_since_spray / 12)
  effective_risk = agrometeo_risk × (1 - protection)
  → < 30 grün | 30–60 gelb | > 60 rot
  ```

**Backend:**
```
GET /api/vineyards/{id}/plant-protection-risk
```
Gibt zurück: `{ peronospora: { risk: 72, level: "rot" }, oidium: { risk: 28, level: "grün" }, lastSprayDate: "2026-04-20" }`

**Frontend:**
- Zwei getrennte Ampel-Icons (Peronospora / Oidium) statt einem
- Tooltip: Erklärung warum grün/gelb/rot + letztes Spritzdatum

---

## 2. Pflanzenschutzhistorie

Die Spritzhistorie ergibt sich direkt aus Tasks mit `category = pflanzenschutz` – kein neues Entity nötig.

**Ansicht auf Wingert-Seite:**
- Letzte 5 Spritzungen mit Datum, Titel, Notizen
- Link zur vollständigen Aufgabenliste gefiltert auf `pflanzenschutz`

---

## 3. Rebschnitt-Dokumentation

**Ziel:** Schnittdaten pro Jahr und Wingert festhalten, um Zusammenhänge zwischen Schnittmethode und Erntequalität über Jahrgänge zu erkennen.

**Entscheidung:** Erfassung pro Wingert (nicht pro Zeile) – direkt mit Erntedaten desselben Jahres korrelierbar.

**Spätere Erweiterung:** Qualitative Beobachtungen pro Zeile via Tasks (`category = rebenpflege`) ergänzen den Datensatz ohne Strukturkomplexität.

### Backend

**Migration 011:**
```sql
CREATE TABLE pruning_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vineyard_id     UUID NOT NULL REFERENCES vineyards(id) ON DELETE CASCADE,
  year            INTEGER NOT NULL,
  pruning_date    DATE NOT NULL,
  schnitt_typ     TEXT NOT NULL,  -- Bogenschnitt | Zapfenschnitt | Minimalschnitt | Sonstiges
  augen_pro_rebe  NUMERIC(4,1),   -- Ø Augen pro Rebe
  notes           TEXT,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vineyard_id, year)
);
```

**Routes:**
```
GET    /api/vineyards/{id}/pruning          ← alle Jahre
POST   /api/vineyards/{id}/pruning          ← neuen Eintrag anlegen
PUT    /api/pruning/{id}                    ← bearbeiten
DELETE /api/pruning/{id}
```

### Frontend

- Eigener Abschnitt auf der Wingert-Seite (oder kombiniert mit Ernte-Seite)
- Formular: Jahr, Datum, Schnitttyp (Toggle), Augen/Rebe, Notizen
- **Analyse-Tabelle:** Jahrgang | Schnitttyp | Augen/Rebe | Ertrag kg | Ø Oechsle
  - Daten aus `pruning_records` + `harvests` JOIN über Jahr und `vineyard_id`
  - Gibt auf einen Blick: hat weniger Augen wirklich mehr Oechsle gebracht?

---

## Implementierungsreihenfolge

```
1. Pflanzenschutz-Ampel (echtes Krankheitsmodell)  → Backend + Frontend
2. Migration 011 (Rebschnitt)                      → Backend + Frontend
```
