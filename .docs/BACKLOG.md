# Wingertmap – Feature Backlog

Stand: 2026-05-13

---

## ✅ 1. Pflanzenschutz-Ampel (Krankheitsmodell) — umgesetzt in 3 Stufen

Spec: `docs/superpowers/specs/2026-05-13-pflanzenschutz-ampel-design.md`
Pläne: `docs/superpowers/plans/2026-05-13-pflanzenschutz-ampel-stufe{1,2,3}.md`

**Was funktioniert:**
- 8 Agrometeo-Modelle angebunden (Mildiou, Oïdium, Black Rot, Botrytis, Acariose, Bois Noir, Vers de la Grappe, Phänologie) via `/api/models/{id}/geojson`
- BLV-PSM-Register-Sync (XML, monatlich aktualisiert) — 600+ Reben-Produkte mit Wirkstoffen, Indikationen, Wartefristen
- Spritz-Erfassung mit Produkt-Picker → Wirkstoffe + Krankheiten werden automatisch abgeleitet
- Auto-Anlage/-Schliessung von Schutzperioden (Dispenser, Mahd-Pause) bei den entsprechenden Task-Subtypen
- Endpoint `/api/vineyards/{id}/disease-risk` mit pro-Krankheit aufgeschlüsselter Ampel (raw/effective)
- Endpoint `/api/vineyards/{id}/disease-risk/{key}/series?from=&to=` für Trend/Forecast
- Pflanzenschutz-Panel im Vineyard-Detail (Kachel-Grid sortiert nach Schwere)
- Klickbare Kacheln → Detail-Modal mit Recharts-Chart + Massnahmen-Timeline
- Periodischer PSM-Sync via Scheduler (7 Tage)
- Stale-Data-Banner wenn PSM-Daten > 60 Tage

---

## 2. Stufe-4-Ideen für die Pflanzenschutz-Ampel (offen)

### 2.1 Push-Benachrichtigungen bei Risiko-Wechsel

Bei grün→rot-Übergang für eine spritzpflichtige Krankheit:
- Web-Push (PWA) und/oder E-Mail
- Pro Vineyard konfigurierbar (manche Parzellen sind reaktionsärmer)
- Cooldown 24h pro Krankheit (kein Spam)

### 2.2 Schwellwert-Live-Plausibilisierung

Aktuell sind die Stufen-Schwellen (`YellowAt`/`RedAt`) im Go-Code hardcoded.
- Beim Startup `/api/models/{id}/legend` von Agrometeo laden
- Wenn die offiziellen Schwellen sich verschieben → Banner für Admin, manueller Sync nötig
- Längerfristig: Schwellen aus DB statt Konstanten

### 2.3 Externer Link zu agrometeo.ch

Im Detail-Modal einen "Auf agrometeo.ch ansehen"-Button mit pre-filled Station + Datum.

### 2.4 Dispenser-/Mahd-Pause-Massnahmen in der Series-Timeline

`series.collectMeasures` liefert aktuell nur Spritzungen. Erweitern um:
- `protection_periods`-Eröffnung/Schliessung als Timeline-Punkte
- Damit zeigt das Modal auch "Dispenser hängt seit X" als ReferenceLine im Chart

### 2.5 BIO/IP-Compliance-Reporting

PSM-Daten enthalten Auflagen (`Obligation` im XML, derzeit nicht importiert). Ausbauen:
- Wartefrist-Warnungen vor Erntezeit
- Max. Anwendungen pro Saison (für viele Produkte gibt's Obergrenzen)
- Export einer "Spritz-Tagebuch"-PDF pro Saison für Kontrollstellen

### 2.6 Wirkstoff-spezifische Schutzdauer

Aktuell ist `DefaultSprayProtectionDays = 12` für alle Spritzungen.
- Kontaktmittel (Folpan): 5-7 Tage
- Systemika (Phosphonate, Strobilurine): 14-21 Tage
- Mapping `Wirkstoff → Schutzdauer` einführen, im Combinator je Wirkstoff-Mix gewichten

### 2.7 Wetter-Forecast über Agrometeo hinaus

Agrometeo liefert ~5 Tage Forecast. Für 7-10 Tage:
- MeteoSchweiz Open-Data oder SwissMetNet anbinden
- Eigenes Lite-Modell oben drauf, das Tag-für-Tag Risiko-Prognose macht

### 2.8 Auto-Vorschlag für nächste Spritzung

Wenn Mildiou-Schutz in 3 Tagen ausläuft + Forecast zeigt Regen → automatische Aufgabe "Spritzung vorbereiten" anlegen.

---

## 3. Andere offene Items (nicht Pflanzenschutz)

(Aktuell keine erfasst — bei Bedarf hier ergänzen.)
