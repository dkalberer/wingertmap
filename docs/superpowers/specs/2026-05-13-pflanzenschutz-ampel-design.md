# Pflanzenschutz-Ampel mit Krankheitsmodell — Design

**Stand:** 2026-05-13
**Status:** Design — wartet auf User-Review
**Bezug:** `.docs/BACKLOG.md` §1 (Pflanzenschutz-Ampel Krankheitsmodell)

---

## 1. Ziel

Die heutige Pflanzenschutz-Ampel (`/api/vineyards/{id}/plant-protection-status`) beurteilt das Risiko nur über `days_since_spray`. Sie soll durch eine **modellbasierte Risikoeinschätzung pro relevanter Reben-Krankheit** ersetzt werden, die das **echte aktuelle Risiko von Agrometeo (VitiMeteo)** mit den **konkret im Wingert eingesetzten Pflanzenschutzmassnahmen** verrechnet.

Endziel: der Winzer sieht in der App, was er sonst auf agrometeo.ch zusammenklickt — pro Parzelle, pro Krankheit, mit Berücksichtigung dessen, was er selbst gemacht hat (Spritzung, Pheromon-Dispenser aufgehängt, Brennnessel-Mahd ausgesetzt).

## 2. Scope

**In Scope:**

- Anbindung von **8 Agrometeo-Modellen** (Mildiou, Oïdium, Black Rot, Botrytis, Acariose, Bois Noir, Vers de la Grappe, Phénologie)
- Import des **offiziellen Schweizer Pflanzenschutzmittel-Registers (BLV)** als XML mit periodischem Sync
- Erweiterung des Task-Modells um **Massnahmen-Subtypen** (`spritzung`, `dispenser-haengen`, `dispenser-entfernen`, `mahd-pause-start`, `mahd-pause-ende`)
- Spritz-Formular mit **Produkt- oder Wirkstoff-Picker** und automatischer Ableitung der abgedeckten Krankheiten
- Neuer Endpoint `/api/vineyards/{id}/disease-risk` mit pro-Krankheit aufgeschlüsseltem Status
- **Pflanzenschutz-Panel** im Frontend (Vineyard-Detail-Seite): Kachel-Grid je Krankheit, sortiert nach effektivem Schweregrad, mit Detail-Modal je Kachel
- Migration des bestehenden `ProtectionBadge` auf einen kombinierten Worst-Of-Status für die Karten-Übersicht

**Out of Scope (für diese Spec):**

- Kosten-/Mengen-Verbrauchsrechnung pro Spritzung
- Wetter-Forecast über Agrometeo hinaus (z.B. SwissMetNet, MeteoSchweiz API)
- Automatischer Push (E-Mail, Web-Push) bei Risiko-Übergang grün→rot — kann später folgen
- BIO/IP-Compliance-Reporting (Auflagen-Tracking aus PSM-Daten ist vorhanden, aber UI dafür nicht in dieser Stufe)
- Reben-Schädlinge ohne Agrometeo-Modell (Reblaus, Grüne Rebzikade, Phomopsis, Weissfäule) — werden zwar im Wirkstoff-Mapping berücksichtigt, aber bekommen keine eigene Ampel-Kachel

## 3. Datenfluss

```
┌──────────────────────┐        ┌────────────────────────┐
│  Agrometeo API       │        │  BLV PSM XML (8 MB ZIP)│
│  /api/models/{id}/   │        │  monatlich aktualisiert │
│  geojson?date=…      │        └───────────┬─────────────┘
└──────────┬───────────┘                    │
           │ pro Krankheit, pro Tag         │ wöchentlicher Sync
           │ raw_index + color              │ Wirkstoffe + Produkte + Indikationen
           ▼                                ▼
┌─────────────────────────────────────────────────────────┐
│  Backend: Disease Risk Service                          │
│                                                          │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────┐  │
│  │ Agrometeo    │  │ Tasks          │  │ PSM-Daten    │  │
│  │ Cache (30m)  │  │ (Subtyp,       │  │ (Substances, │  │
│  └──────┬───────┘  │  SprayApps)    │  │  Pests,      │  │
│         │          └────────┬───────┘  │  Products,   │  │
│         │                   │          │  Indications)│  │
│         │                   │          └──────┬───────┘  │
│         ▼                   ▼                 ▼          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  Combinator: effective_level per disease         │    │
│  │   raw + active_measures = effective              │    │
│  └──────────────┬───────────────────────────────────┘    │
└─────────────────┼────────────────────────────────────────┘
                  │
                  ▼  GET /api/vineyards/{id}/disease-risk
┌─────────────────────────────────────────────────────────┐
│  Frontend                                                │
│  ┌─────────────────────────┐                            │
│  │ Vineyard-Detail-Seite   │                            │
│  │  Phenologie-Header      │                            │
│  │  Pflanzenschutz-Panel   │                            │
│  │   ┌──┐ ┌──┐ ┌──┐ ┌──┐  │  klick → Detail-Modal      │
│  │   │ M│ │ O│ │ B│ │ T│  │   (7d Trend + Forecast)    │
│  │   └──┘ └──┘ └──┘ └──┘  │                            │
│  │  CTA "Massnahme erfassen"                           │
│  └─────────────────────────┘                            │
│  ┌─────────────────────────┐                            │
│  │ Karten-Übersicht         │   ProtectionBadge = worst │
│  └─────────────────────────┘                            │
└─────────────────────────────────────────────────────────┘
```

## 4. Externe Datenquellen — verifiziert

### 4.1 Agrometeo Modell-API

**Endpoint:** `GET https://api.agrometeo.ch/api/models/{modelId}/geojson?date=YYYY-MM-DD`

- Keine Authentifizierung
- Liefert pro Request eine GeoJSON-FeatureCollection mit allen ~150 Stationen für den angefragten Tag
- Forecast-Tage (bis ~5 Tage in der Zukunft) werden als reguläre Tagespunkte geliefert (im Web als "Prévisions" grau markiert)
- Pro Feature relevant: `station_id`, `station_name`, `index` (numerisch), `color` (CSS-Hex oder Name), `time`
- Für Modelle 9/12/16 zusätzlich modell-spezifische Felder (`Risikolevel`, `Risikostufe`, `Temperatursumme`)

**Reben-relevante Modelle:**

| ID | space_name | Name (DE) | Skala / Einheit | Bedeutung Index |
|----|------------|-----------|------------------|-----------------|
| 7  | mildiou    | Falscher Mehltau (Plasmopara viticola) | 0..>200 | Infektionsschwere ("Gradstunden") |
| 8  | oidium     | Echter Mehltau (Erysiphe necator)     | 0..100  | Risiko in % |
| 9  | bois-noir  | Bois Noir / Schwarzholzkrankheit       | 0..100  | Brennnessel-Temperatursumme in % |
| 11 | black-rot  | Black Rot (Guignardia bidwellii)      | 0..>300 | Infektionsschwere |
| 12 | acariose   | Acariose (Kräuselmilbe)               | 0..>550 | Tempsumme °C-Tage |
| 14 | vm-phenologie | Phänologie                          | BBCH 09-89 | Entwicklungsstadium |
| 15 | (kein space_name) | Botrytis                       | (saisonal aktiv) | Infektionsschwere |
| 16 | grappe     | Vers de la Grappe (Traubenwickler)    | 0..>2500 | Degré-jours, Flugphasen |

Modelle **10 (Tavelure/Apfelschorf)** und **13 (Feu Bactérien)** betreffen Obst, nicht Reben → ausgeschlossen.

**Legend-Endpoint:** `GET https://api.agrometeo.ch/api/models/{modelId}/legend` — liefert die offiziellen Schwellwerte und Beschreibungen je Modell. Wir laden das einmalig beim Start und cachen 24 h (Schwellwerte ändern sich praktisch nie).

### 4.2 BLV Pflanzenschutzmittelverzeichnis

**Download:** `https://www.blv.admin.ch/dam/blv/de/dokumente/zulassung-pflanzenschutzmittel/pflanzenschutzmittelverzeichnis/daten-pflanzenschutzmittelverzeichnis.zip.download.zip/Daten%20Pflanzenschutzmittelverzeichnis.zip`

- ZIP ~8 MB → enthält `PublicationData.xml` (~62 MB) + `XSD-Schema.xsd`
- Monatlich aktualisiert (Stand z.Zt. 07.05.2026)
- Saubere XSD-Definition, Streaming-parsebar

**Datenstruktur (gekürzt):**

```
PublicationData
├── Products[]                       (1737 Produkte)
│   └── Product { id, wNbr, name, exhaustionDeadline, soldoutDeadline, terminationReason }
│       └── ProductInformation
│           ├── Ingredient[]         { inPercent | inGrammPerLitre }
│           │   ├── SubstanceType    (active | …)
│           │   └── Substance[]      → MetaData/Substance.primaryKey
│           └── Indication[]         { dosageFrom, dosageTo, waitingPeriod, expenditureForm }
│               ├── Measure          (z.B. "Spritzung")
│               ├── Culture          → MetaData/Culture.primaryKey  (Reben = 2314EB9F-…)
│               ├── Pest             → MetaData/Pest.primaryKey + type
│               ├── ApplicationArea  (Feld, Gewächshaus, …)
│               └── Obligation       (Auflagen)
├── Parallelimports[]                (644 Parallelimporte)
├── MetaData (22 Sektionen):
│   ├── Substance (454)              (Wirkstoffe)
│   ├── Pest (858)                   (Schaderreger)
│   ├── Culture (315)                (Kulturen)
│   ├── Product Category (103)
│   ├── Measure / TimeMeasure / ApplicationArea / DangerSymbol / SignalWord …
│   └── PermissionHolder (211)
```

**Reben-relevanter Filter:** Indikation behalten ⇔ `Indication.Culture.primaryKey == REBEN_ID`. Daraus ergeben sich Produkt-, Wirkstoff- und Schaderreger-Untermengen.

### 4.3 Mapping PSM-Schaderreger → Agrometeo-Modell

**Hardcoded in der Anwendung** (Schaderreger-IDs sind stabile UUIDs, Agrometeo-Modelle eine kleine fixe Liste). Nicht in DB, sondern als Konstante im Code, weil:

- pflegeintensiv & semantisch (kein automatisches Matching möglich)
- Bei Änderung muss ohnehin Code angefasst werden (Skalen-Mapping, Massnahme-Logik)

| Agrometeo-Modell | PSM-Pest UUID(s) | Wingertmap-Diseasekey |
|---|---|---|
| 7 (Mildiou)     | `0251FEEA-4E71-4881-8B0A-09874F39277A` | `mildiou` |
| 8 (Oïdium)      | `9060AEC1-F131-4C7E-AB10-40BAFEC297B3` | `oidium` |
| 11 (Black Rot)  | `0827836E-3719-423D-9340-5413DEBC42B4` | `black-rot` |
| 12 (Acariose)   | `204C2B56-CC1A-435D-B9EA-C493D9EB5115` | `acariose` |
| 15 (Botrytis)   | `02EE16EA-7294-4D6D-AA3D-4A3AE7D5F6DF` | `botrytis` |
| 16 (Grappe)     | `884FBF9B-A098-4936-9CAA-57056026D69E`, `5AC77F67-…`, `711C42AB-…` | `traubenwickler` |
| 9 (Bois Noir)   | `41FC4719-6F5E-49AF-80AA-A3F1F687E689` (Vektor Scaphoideus) | `bois-noir` |
| 14 (Phénologie) | — (keine Massnahme) | `phenologie` |

## 5. Datenmodell

### 5.1 Neue Tabellen

```sql
-- BLV-PSM-Datenbestand (re-importable, mit syncedAt versioniert)

CREATE TABLE psm_substances (
  id              UUID PRIMARY KEY,              -- BLV primaryKey
  name_de         TEXT NOT NULL,
  name_fr         TEXT,
  name_it         TEXT,
  synced_at       TIMESTAMPTZ NOT NULL
);

CREATE TABLE psm_pests (
  id              UUID PRIMARY KEY,
  name_de         TEXT NOT NULL,
  name_fr         TEXT,
  name_it         TEXT,
  synced_at       TIMESTAMPTZ NOT NULL
);

CREATE TABLE psm_products (
  id              TEXT PRIMARY KEY,              -- BLV product.id (z.B. "4090")
  w_nbr           TEXT NOT NULL,                 -- W-Nummer
  name            TEXT NOT NULL,
  permission_holder_id UUID,
  exhaustion_deadline DATE,
  soldout_deadline    DATE,
  termination_reason  TEXT,
  is_parallel_import  BOOLEAN NOT NULL DEFAULT FALSE,
  synced_at       TIMESTAMPTZ NOT NULL
);

CREATE TABLE psm_product_substances (
  product_id      TEXT NOT NULL REFERENCES psm_products(id) ON DELETE CASCADE,
  substance_id    UUID NOT NULL REFERENCES psm_substances(id),
  in_percent      NUMERIC(8,4),
  in_gramm_per_litre NUMERIC(10,4),
  PRIMARY KEY (product_id, substance_id)
);

CREATE TABLE psm_indications (
  id              BIGSERIAL PRIMARY KEY,
  product_id      TEXT NOT NULL REFERENCES psm_products(id) ON DELETE CASCADE,
  pest_id         UUID NOT NULL REFERENCES psm_pests(id),
  culture_id      UUID NOT NULL,                 -- REBEN_ID-fixiert in dieser Tabelle
  dosage_from     NUMERIC(10,4),
  dosage_to       NUMERIC(10,4),
  dosage_unit     TEXT,
  waiting_period_days INTEGER,
  application_area TEXT,
  expenditure_form TEXT
);

CREATE INDEX psm_indications_pest_idx     ON psm_indications(pest_id);
CREATE INDEX psm_indications_product_idx  ON psm_indications(product_id);

CREATE TABLE psm_sync_meta (
  id              INT PRIMARY KEY DEFAULT 1,     -- Singleton row
  last_sync_at    TIMESTAMPTZ NOT NULL,
  source_publication_date DATE,
  product_count   INT,
  status          TEXT,                          -- 'ok' | 'failed' | 'running'
  error_message   TEXT,
  CHECK (id = 1)
);
```

**Hinweis zu `culture_id` in `psm_indications`:** Wir importieren nur Reben-Indikationen (Filter beim Sync). Die `culture_id`-Spalte ist redundant, bleibt aber als Sicherheitsnetz drin, falls wir später weitere Kulturen aufnehmen.

### 5.2 Erweiterung Task-Modell

Neue Spalte auf `tasks`:

```sql
ALTER TABLE tasks
  ADD COLUMN subtype TEXT;  -- NULL für nicht-Pflanzenschutz; sonst:
                            -- 'spritzung' | 'dispenser-haengen' | 'dispenser-entfernen'
                            -- 'mahd-pause-start' | 'mahd-pause-ende'

ALTER TABLE tasks
  ADD CONSTRAINT tasks_subtype_requires_pflanzenschutz
    CHECK (subtype IS NULL OR category = 'pflanzenschutz');
```

Neue Tabelle für strukturierte Spritz-Daten (1:1 mit `tasks` wenn `subtype = 'spritzung'`):

```sql
CREATE TABLE spray_applications (
  task_id         UUID PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
  product_id      TEXT REFERENCES psm_products(id),   -- optional, NULL bei freier Wirkstoff-Eingabe
  substance_ids   UUID[] NOT NULL,                    -- Wirkstoffe, vom Produkt abgeleitet ODER manuell
  target_pest_ids UUID[],                             -- NULL = "alle laut Indikation"; sonst eingeschränkt
  dosage          NUMERIC(10,4),
  dosage_unit     TEXT,
  applied_at      TIMESTAMPTZ NOT NULL,               -- meist == task.created_at
  notes           TEXT
);
```

Neue Tabelle für saisonale/periodische Massnahmen (Dispenser, Mahd-Pause):

```sql
CREATE TABLE protection_periods (
  id              UUID PRIMARY KEY,
  vineyard_id     UUID NOT NULL REFERENCES vineyards(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,                      -- 'dispenser' | 'mowing-pause'
  start_task_id   UUID NOT NULL REFERENCES tasks(id),
  end_task_id     UUID REFERENCES tasks(id),          -- NULL = noch aktiv
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ,                        -- NULL = noch aktiv; sonst aus end_task gespiegelt
  target_pest_ids UUID[] NOT NULL                     -- typischerweise traubenwickler-pests bei dispenser
);

CREATE INDEX protection_periods_vineyard_idx ON protection_periods(vineyard_id);
CREATE INDEX protection_periods_active_idx   ON protection_periods(vineyard_id, kind)
  WHERE end_at IS NULL;
```

**Pflege:** Wenn ein Task mit Subtyp `dispenser-haengen` erstellt wird → Service legt automatisch eine `protection_periods`-Zeile an (kind=`dispenser`, `start_task_id`). Bei `dispenser-entfernen` → entsprechende offene Periode wird mit `end_task_id`/`end_at` geschlossen. Analog für Mahd-Pause.

### 5.3 Konfigurations-Konstanten (Code, nicht DB)

```go
// internal/protection/config.go

const RebenCultureID = "2314EB9F-7207-409F-A0D4-89B6A1177363"

// Wartedauer der "klassischen" Spritzung in Tagen (Mittelwert über alle Kontakt-/Systemika)
// — wird später ggf. wirkstoff-spezifisch in DB ausgelagert
const DefaultSprayProtectionDays = 12

// Diseasekey → Agrometeo-Modell + PSM-Pest-IDs + Massnahme-Typ + Schwellwert-Mapping
var Diseases = []Disease{
  {Key: "mildiou", AgrometeoModelID: 7, PSMPestIDs: [...]},
  ...
}
```

## 6. Domänenlogik

### 6.1 Pro Krankheit: Roh-Level aus Agrometeo-Index

Jedes Modell hat eine eigene Skala. Wir mappen auf drei interne Stufen **`grün` / `gelb` / `rot`**:

| Diseasekey | Quelle | grün | gelb | rot |
|---|---|---|---|---|
| mildiou         | model 7 `index`  | < 50           | 50 – 100        | > 100 |
| oidium          | model 8 `index`  | < 34           | 34 – 66         | > 66  |
| black-rot       | model 11 `index` | < 85           | 85 – 150        | > 150 |
| acariose        | model 12 `index` | < 300          | 300 – 550       | > 550 |
| botrytis        | model 15 `index` | leer = grün (Modell ausserhalb Saison inaktiv) | wenn Saison aktiv: tatsächliche Schwellen anhand Legend-Endpoint setzen (siehe §12) | s.o. |
| traubenwickler  | model 16 `Risikolevel` (1..5) | 1 | 2 | ≥ 3 |
| bois-noir       | model 9 `Risikostufe` | 0–1       | 2               | 3 |
| phenologie      | model 14 `index` (BBCH-Code) | — (nur Anzeige) | — | — |

Die Schwellen folgen den offiziellen Agrometeo-Legends. Sie werden im Code als Konstanten geführt und können beim Sync via `/api/models/{id}/legend` plausibilisiert werden.

### 6.2 Pro Krankheit: aktive Massnahme finden

| Diseasekey | Massnahme | DB-Quelle |
|---|---|---|
| mildiou / oidium / black-rot / botrytis / acariose | Letzte Spritzung, deren `target_pest_ids` (oder abgeleitete Indikationen) den Pest enthalten und deren `applied_at` < heute − DefaultSprayProtectionDays | `tasks` + `spray_applications` |
| traubenwickler | Aktive Periode `kind='dispenser'` deren `target_pest_ids` Traubenwickler enthält | `protection_periods` |
| bois-noir | Aktive Periode `kind='mowing-pause'` | `protection_periods` |
| phenologie | — | — |

### 6.3 Kombinator: effektives Level

```
für jede disease in Diseases:
    raw_index, raw_level, forecast = fetch_agrometeo(disease.modelId, today)
    measure = find_active_measure(disease, vineyard_id)

    if disease.key == "phenologie":
        effective_level = nil   # nur Anzeige
        recommendation  = bbchLabel(raw_index)

    elif measure is None:
        effective_level = raw_level
        recommendation  = recommendDefault(disease, raw_level)

    elif measure.type == "spray":
        days_since   = days_between(measure.applied_at, today)
        protection   = max(0, 1 - days_since / DefaultSprayProtectionDays)
        # Skala-bewusst: gelbes Risiko mit 80% Schutz wird grün; rotes Risiko mit 50% Schutz bleibt gelb
        effective_index = raw_index * (1 - protection)
        effective_level = mapToLevel(disease, effective_index)
        recommendation  = recommendSpray(disease, effective_level, days_since)

    elif measure.type in ("dispenser", "mowing-pause"):
        # Strukturelle Schutzmassnahme; setzt Ampel auf grün, aber raw_level bleibt sichtbar
        effective_level = "grün"
        recommendation  = sprintf("%s aktiv seit %s", measure.type, measure.start_at)
```

**Ergebnis pro Krankheit:**

```json
{
  "key": "mildiou",
  "name": "Falscher Mehltau",
  "modelId": 7,
  "raw": { "index": 226.86, "level": "rot", "color": "#ff0000", "time": "2026-05-12" },
  "effective": { "level": "rot", "index": 226.86 },
  "measure": null,
  "recommendation": "Spritzung dringend empfohlen",
  "forecast": [ { "date": "2026-05-14", "index": 0, "level": "grün" }, ... ]
}
```

### 6.4 Worst-Of für Karten-Übersicht

Für die alte `ProtectionBadge` (Vineyard-Liste / Karte) berechnen wir das aggregierte schlechteste `effective.level` über alle **Spritz-Krankheiten** (Mildiou, Oïdium, Black Rot, Botrytis, Acariose). Traubenwickler und Bois Noir werden **nicht** mitgezählt, weil sie eigene Massnahmen-Logik haben und sonst in 99% der Fälle die Ampel verfälschen würden.

## 7. API

### 7.1 Disease Risk

```
GET /api/vineyards/{id}/disease-risk
```

**Response:**

```json
{
  "vineyardId": "…",
  "stationId": 138,
  "stationName": "SARGANS",
  "fetchedAt": "2026-05-13T14:00:00Z",
  "phenology": { "bbchRange": "60-69", "label": "Blüte", "rawIndex": 65 },
  "diseases": [
    {
      "key": "mildiou",
      "name": "Falscher Mehltau",
      "modelId": 7,
      "rawLevel": "rot",
      "rawIndex": 226.86,
      "effectiveLevel": "rot",
      "measureType": null,
      "lastMeasureAt": null,
      "recommendation": "Spritzung dringend empfohlen — Risiko-Index 227 (> 100)",
      "infoUrl": "https://www.agrometeo.ch/de/mildiou"
    },
    {
      "key": "traubenwickler",
      "name": "Traubenwickler",
      "modelId": 16,
      "rawLevel": "rot",
      "rawIndex": 1676.32,
      "effectiveLevel": "grün",
      "measureType": "dispenser",
      "lastMeasureAt": "2026-03-22T08:00:00Z",
      "recommendation": "Dispenser aktiv seit 22.03. — kein Eingreifen nötig",
      "infoUrl": "https://www.agrometeo.ch/de/vers-de-la-grappe"
    }
  ]
}
```

Sortierung: effective `rot` zuerst, dann `gelb`, dann `grün`. `phenologie` separat im `phenology`-Feld.

### 7.2 Detail Trend & Forecast (Stufe 3)

```
GET /api/vineyards/{id}/disease-risk/{diseaseKey}/series?from=YYYY-MM-DD&to=YYYY-MM-DD
```

Liefert pro Tag im Bereich (max 14 Tage) einen Index-Datenpunkt von Agrometeo. Backend macht im Hintergrund N Calls und cached aggressiv (24 h pro Tag-Wert, da Vergangenheit unveränderlich; heute & Forecast 30 min).

### 7.3 PSM-Produkt-Lookup

```
GET /api/psm/products?q=…&limit=20
GET /api/psm/products/{id}
GET /api/psm/substances?q=…&limit=20
```

`products?q=` liefert Produktnamen mit `LIKE %q%`, Sortierung "kürzlich von diesem User verwendet" zuerst, dann alphabetisch. `products/{id}` liefert vollständige Indikationsliste (Pest, Dosis, Wartefrist).

### 7.4 Spritzung erfassen

Bestehendes `POST /api/tasks` wird um Felder erweitert:

```jsonc
{
  "title": "Spritzung Mildiou + Oidium",
  "category": "pflanzenschutz",
  "subtype": "spritzung",
  "vineyardId": "…",
  "spray": {
    "productId": "4090",                  // optional, oder substanceIds direkt
    "substanceIds": ["683783D6-…", "112F60C6-…"],
    "targetPestIds": null,                // null = alle Indikationen für die Wirkstoffe
    "dosage": 0.125,
    "dosageUnit": "%",
    "appliedAt": "2026-05-13T07:00:00Z"
  }
}
```

Backend validiert, dass alle `substanceIds` zu `productId` passen wenn beides gegeben, leitet `targetPestIds` aus `psm_indications` ab, persistiert in `tasks` + `spray_applications`.

### 7.5 Dispenser / Mahd-Pause

```jsonc
POST /api/tasks
{
  "category": "pflanzenschutz",
  "subtype": "dispenser-haengen",
  "vineyardId": "…",
  "title": "Traubenwickler-Dispenser ausgehängt"
}
// → Service legt protection_periods-Zeile an (kind=dispenser, target=Traubenwickler-Pests)

POST /api/tasks
{ "subtype": "dispenser-entfernen", "vineyardId": "…", … }
// → schliesst offene dispenser-Periode der gleichen Parzelle
```

Analog für `mahd-pause-start` / `mahd-pause-ende`.

### 7.6 PSM-Sync

```
POST /api/admin/psm-sync      # manuell triggern (Admin only)
GET  /api/admin/psm-sync      # Status: { lastSyncAt, sourcePublicationDate, productCount, status }
```

Cron-Job (z.B. via `robfig/cron`) ruft den gleichen Sync-Service einmal pro Woche auf. Bei App-Start: prüft `psm_sync_meta`, ruft Sync auf wenn leer oder älter als 30 Tage.

## 8. Backend-Architektur

### 8.1 Package-Layout

```
apps/backend/internal/
├── agrometeo/        (bestehend) — Client+Cache
│   ├── client.go     erweitert um FetchModel(modelId, date) und FetchLegend(modelId)
│   └── cache.go      erweitert um Disease-Caches
├── psm/              (neu) — BLV-Datenimport
│   ├── client.go     ZIP download + XML parsing
│   ├── sync.go       Sync-Service (zieht XML, filtert Reben, upsertet)
│   └── store.go      Read-Queries (products, substances, indications)
├── protection/       (neu) — Disease-Risk-Domäne
│   ├── config.go     Diseases, Thresholds, Mappings
│   ├── service.go    DiseaseRiskService.Compute(vineyardId)
│   └── combinator.go raw + measure → effective
├── handler/
│   ├── weather.go    bestehend; PlantProtectionStatus wird deprecated, leitet Worst-Of weiter
│   ├── disease.go    (neu) DiseaseRisk + DiseaseRiskSeries
│   ├── psm.go        (neu) Products / Substances Search
│   └── task.go       erweitert: subtype + spray-Felder
├── store/
│   ├── task.go       erweitert um SprayApplication-Methoden
│   ├── protection.go (neu) protection_periods CRUD
│   └── psm.go        (neu) PSM-Tabellen-Operationen
```

### 8.2 Sync-Service-Flow

```
SyncPSM():
  1. last_sync prüfen — falls < 7 Tage: abbrechen (idempotent)
  2. status='running' setzen
  3. ZIP runterladen, in Temp-Datei schreiben
  4. ZIP öffnen, PublicationData.xml als Stream entpacken
  5. XML mit encoding/xml.Decoder als Token-Stream lesen:
     a. zuerst MetaData-Sektionen sammeln (Substance, Pest, Culture)
     b. dann Products durchlaufen:
        - Indikationen filtern auf Culture == REBEN_ID
        - wenn keine Reben-Indikation: Product überspringen
        - sonst: Product + Ingredients + Indications puffern
     c. Parallelimports analog (mit isParallelImport=true)
  6. In Transaktion:
     - psm_substances, psm_pests upsert (nur die referenzierten)
     - psm_products upsert
     - psm_product_substances DELETE/INSERT pro product_id
     - psm_indications DELETE/INSERT pro product_id
     - psm_sync_meta aktualisieren (status='ok', publicationDate, count)
  7. Bei Fehler: status='failed', error_message setzen, alte Daten bleiben drin
```

**Memory-Budget:** XML ist 62 MB. Streaming-Parser braucht <100 MB Heap. Pro Sync ein vorübergehender Spike — akzeptabel für einen wöchentlichen Job.

**Race-Schutz:** Sync ist single-flight (Mutex im Service). Read-Pfade lesen während Sync ihre alten Daten weiter.

### 8.3 Agrometeo-Erweiterung

```go
// internal/agrometeo/client.go

func (c *Client) FetchModelGeojson(ctx context.Context, modelID int, date time.Time) (*ModelData, error) {
    // GET /api/models/{modelID}/geojson?date=YYYY-MM-DD
    // → FeatureCollection
    // Wir interessieren uns nur für features[].properties — keine geometry-Logik nötig
}

func (c *Client) FetchModelLegend(ctx context.Context, modelID int) ([]LegendBucket, error) { … }
```

Cache:

```go
// internal/agrometeo/cache.go — erweitert
// Key = (modelID, date.Format("2006-01-02"))
// Eine API-Antwort enthält bereits alle Stationen — pro-Vineyard wird die nächste
// Station erst nach dem Fetch aus dem Cache-Treffer extrahiert.
// TTL:
//   - heute / Forecast: 30 min
//   - Vergangenheit (< heute): 24 h (Werte ändern sich nicht mehr signifikant)
```

## 9. Frontend

### 9.1 Komponenten-Hierarchie

```
VineyardDetailPage
├── ProtectionPanel               (neu, ersetzt den ProtectionBadge an dieser Stelle)
│   ├── PhenologyHeader           (BBCH-Stadium + Wetterstation)
│   ├── DiseaseGrid               (Kachel-Grid, sortiert nach Schwere)
│   │   └── DiseaseCard[]
│   │       ├── Header (Icon, Name)
│   │       ├── EffectiveAmpel    (Hauptstatus, gross)
│   │       ├── RawAmpel          (klein, wenn ≠ effective)
│   │       ├── Recommendation    (1-Zeiler)
│   │       └── LastMeasureInfo   (falls vorhanden)
│   ├── PsmInfoFooter             ("Datenstand BLV: 07.05.2026")
│   └── ActionBar                 ("Massnahme erfassen" → öffnet TaskForm vorausgefüllt)
└── DiseaseDetailModal            (auf Kachel-Klick, Stufe 3)
    ├── TrendChart                (7 Tage zurück, ECharts oder Recharts)
    ├── ForecastChart             (5 Tage voraus)
    ├── MeasureTimeline           (Liste eigener Massnahmen)
    └── ExternalLink              ("Auf agrometeo.ch ansehen")

VineyardListPage / MapPopover
└── ProtectionBadge               (bestehend; intern angepasst: nutzt Worst-Of aus /disease-risk)

TaskForm (bestehend, erweitert)
├── SubtypeSelector               (sichtbar wenn category=pflanzenschutz)
└── SprayDetailFields             (sichtbar wenn subtype=spritzung)
    ├── ProductAutocomplete       (live-search gegen /api/psm/products)
    ├── SubstancesDisplay         (read-only; aus Produkt abgeleitet)
    ├── TargetsDisplay            (Toggle-Chips; Default = alle Indikationen)
    ├── DosageInput               (optional)
    └── ExpectedHarvestHint       (aus waitingPeriodDays + heute)
```

### 9.2 TaskForm-Verhalten

- Bei `category = "pflanzenschutz"` erscheint `SubtypeSelector` (Dropdown: Spritzung / Dispenser aufhängen / Dispenser entfernen / Mahd-Pause starten / Mahd-Pause beenden)
- Bei `subtype = "spritzung"` werden Felder unter `SprayDetailFields` sichtbar
  - ProductAutocomplete fragt `/api/psm/products?q=…`; bei Auswahl werden Wirkstoffe und Indikationen (Targets) automatisch gefüllt
  - Alternativer Tab "Wirkstoffe direkt eingeben" (für Tankmischungen ohne registriertes Produkt)
  - Hint "Ernte frühestens ab 27.05.2026 möglich" (heute + waitingPeriod)
- Bei `subtype = "dispenser-haengen"` keine zusätzlichen Felder; Backend setzt `target_pest_ids` auf die Traubenwickler-Pest-Liste
- Bei `subtype = "mahd-pause-start"` keine zusätzlichen Felder

### 9.3 Sortierung und Farbgebung

Kacheln werden absteigend nach effective-Severity sortiert: `rot` → `gelb` → `grün`. Innerhalb gleicher Stufe alphabetisch nach `name`.

Ampel-Farben kommen aus `theme.palette` (success/warning/error), nicht hartcodiert. Konsistent mit dem bestehenden `ProtectionBadge`.

### 9.4 Mobil-Verhalten

Kachel-Grid ist responsiv: 4 Spalten Desktop, 2 Tablet, 1 Mobile. Kachelhöhe einheitlich; bei wenig Inhalt füllt Whitespace die Karte.

## 10. Bauplan in 3 Stufen

### Stufe 1 — Foundation (Backend + Spritz-Erfassung)

**Lieferumfang:**

- Migration: alle `psm_*`-Tabellen, `task.subtype`, `spray_applications`, `protection_periods`
- Package `psm/`: XML-Sync-Service (initial manuell triggerbar via Admin-Endpoint)
- Package `protection/`: Disease-Risk-Service mit Combinator
- Erweiterung `agrometeo/client`: `FetchModelGeojson`
- Neuer Handler `disease.go` + Endpoint `/api/vineyards/{id}/disease-risk`
- Erweiterung `task.go` Handler: Subtype-Feld + Spray-Persistierung
- Endpoints `/api/psm/products`, `/api/psm/substances`
- Frontend: TaskForm-Erweiterung (Subtyp + Produkt-Picker)
- Frontend: ProtectionBadge umstellen auf Worst-Of-Antwort aus `/disease-risk`

**Out of Stufe 1:** Pflanzenschutz-Panel-UI, Dispenser/Mahd-Pause-Buchung über protection_periods (Sub­types existieren, aber Combinator-Logik macht hier nur Spritz-Pfad).

**Akzeptanz:** Ich kann eine Spritzung mit Folpan erfassen und der neue `/disease-risk`-Endpoint zeigt für Mildiou/Black Rot/Botrytis/Echter Mehltau die korrekt reduzierte Ampel basierend auf den abgeleiteten Indikationen.

### Stufe 2 — Spezielle Massnahmen + Pflanzenschutz-Panel

**Lieferumfang:**

- `protection_periods`-Verwaltung im Task-Service (auto-create/auto-close je Subtyp)
- Combinator-Erweiterung für Dispenser und Mahd-Pause
- Frontend: `ProtectionPanel` mit `PhenologyHeader` + `DiseaseGrid` + `DiseaseCard` (ohne Detail-Modal)
- Frontend: TaskForm-Subtypen für Dispenser/Mahd-Pause
- Cron-Job für PSM-Sync (wöchentlich)
- Cron-Job: Stale-Detection (PSM-Daten älter 60 Tage → Banner)

**Akzeptanz:** Traubenwickler-Kachel ist grün, sobald ich einen "Dispenser aufhängen"-Task erfasst habe, auch wenn Agrometeo-Index hoch ist. Tooltip erklärt die Diskrepanz.

### Stufe 3 — Detail-Tiefe

**Lieferumfang:**

- Endpoint `/api/vineyards/{id}/disease-risk/{diseaseKey}/series`
- Frontend: `DiseaseDetailModal` mit Trend- + Forecast-Charts und Massnahmen-Timeline
- Schwellwerte aus `/api/models/{id}/legend` plausibilisieren und ggf. anpassen
- Phänologie-Anzeige im Header voll integriert (heutiges BBCH-Stadium, optional historisch im Modal)

**Akzeptanz:** Klick auf eine Kachel zeigt einen 14-Tage-Verlauf mit Forecast und meine Massnahmen-History für diese Krankheit.

## 11. Risiken und Annahmen

| # | Risiko / Annahme | Mitigation |
|---|---|---|
| R1 | Agrometeo API ändert Pfade oder bricht Pagination | Aktuell ohne offizielle Garantie. Wir cachen 30 min, alle Aufrufe gehen über `agrometeo.Client` als single point of change. Falls Bruch: Fallback auf "kein Modell-Wert verfügbar" mit erkennbarem UI-Marker. |
| R2 | BLV ändert XML-Schema (z.B. UUID-Migration aus Release-Notes 2025) | Wir nutzen die neue UUID-Welt direkt. Bei Schema-Drift: Sync schlägt fehl, `psm_sync_meta.status='failed'`, alte Daten bleiben aktiv; Admin sieht Alert im Banner. |
| R3 | DefaultSprayProtectionDays = 12 ist eine Vereinfachung — Kontaktmittel halten 5–7 Tage, Systemika 14–21 Tage | OK für MVP. Stufe-2-Folgearbeit: pro Wirkstoff in einer Mapping-Tabelle Schutzdauer hinterlegen, beim Combinator gewichten. |
| R4 | Botrytis-Modell (15) liefert leere Features ausserhalb der Saison | Wir behandeln "keine Daten" als `grün` + Hinweis "Modell aktuell saisonal inaktiv". |
| R5 | PSM-Pest-IDs könnten sich bei Daten-Reorganisation ändern | Mapping `PSM-Pest → Diseasekey` in Code; Test prüft, dass nach jedem Sync alle gemappten Pest-IDs noch existieren. |
| R6 | Spritz-Targets vs. tatsächliche Wirkung — die Indikationen sagen nur was *zugelassen* ist, nicht was *effektiv* wirkt | Wir kommunizieren das im UI: "Wirkt laut BLV-Register gegen X, Y, Z". Stufe 3: optional manuelle Override pro Spritzung. |
| R7 | Mehrere Spritzungen kurz hintereinander — welche zählt? | Wir nehmen die `MAX(applied_at)` pro `pest_id`. Beispiel: am 01.05. Folpan (Mildiou+Black Rot), am 03.05. Sulfur (Echter Mehltau). Resultat: Mildiou-Schutz seit 01.05., Echter-Mehltau-Schutz seit 03.05. |
| R8 | Daten-Lizenz BLV — kommerzielle Nutzung braucht Genehmigung | Wir nennen Quelle und Stand im UI-Footer; private Bewirtschafter-App ist kein kommerzieller Vertrieb der Daten. Wenn Wingertmap später SaaS wird, BLV anfragen. |

## 12. Offene Punkte für die Implementierung

- **Threshold-Mapping Botrytis** ist noch unklar; in Stufe 2 mit echten Daten validieren
- **Bois Noir Massnahme** — Modell warnt erst bei 100%; im Combinator als binäre Schwelle einbauen, nicht 3-stufig
- **Spritzung mit Adjuvanten** (Netzmittel etc.) — Adjuvant kommt im PSM-Register als eigenes Produkt; muss ignoriert werden für Target-Ableitung (kein Pest in Indications). Code-Branch: wenn `psm_indications` für ein Produkt leer, ist es ein Adjuvant.
- **Standort-Sensoren falls Station ausfällt** — `agrometeo.NearestStation` nimmt aktuell die geometrisch nächste; was wenn `data_until` veraltet? Aktuell ignoriert. Stufe 2: bevorzuge Station mit aktuellem `data_until`.

---

**Nächster Schritt:** User-Review dieses Dokuments. Nach Freigabe: Implementation Plan via `superpowers:writing-plans`.
