# Wingertmap – Feature Backlog

Stand: 2026-04-28

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
