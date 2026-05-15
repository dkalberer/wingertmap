# Pflanzenschutz-Ampel — Stufe 5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Ersetze die pauschale `DefaultSprayProtectionDays = 12`-Schutzdauer durch ein realistisches Modell, das Wirkstoff-Klasse, Wachstumsphase (BBCH) und Regen-Erosion berücksichtigt. Plus zwei UI-Verbesserungen: PDF-Reports von Mildiou/Oïdium inline einbetten und im Karten-Header die effektive Restschutz-Dauer anzeigen.

**Architecture:** Neue Datei `internal/protection/substance_classes.go` mit kuratiertem Mapping. `internal/protection/protection_duration.go` berechnet die effektive Schutzdauer aus Spritzung + BBCH + Niederschlag. Der Combinator nutzt diese Funktion statt des pauschalen Wertes. Frontend zeigt im DiseaseCard einen Mini-Hinweis "Schutz: X / Y Tage" und versucht PDF inline via iframe (Fallback: Link).

---

## File Structure

### Backend — Neu
- `apps/backend/internal/protection/substance_classes.go` — Wirkstoff → Klasse Map + Klassen-Definitionen
- `apps/backend/internal/protection/protection_duration.go` — `EffectiveProtection(spray, hourly, bbch, now)` Funktion
- `apps/backend/internal/protection/protection_duration_test.go` — Table-Tests

### Backend — Modifikationen
- `apps/backend/internal/protection/combinator.go` — `Combine` ruft `EffectiveProtection` statt der `1 - days/12`-Formel
- `apps/backend/internal/protection/service.go` — Compute liefert Wetter-seit-Spritzung + BBCH an Combinator (Signatur erweitern)
- `apps/backend/internal/protection/series.go` — bekommt evtl. die gleiche Behandlung in `collectMeasures` (optional)

### Frontend — Modifikationen
- `apps/frontend/src/types/index.ts` — `DiseaseResult` bekommt `protectionDaysTotal` und `protectionDaysRemaining`
- `apps/frontend/src/components/Vineyard/DiseaseCard.tsx` — zeigt "Schutz: X/Y Tage" wenn vorhanden
- `apps/frontend/src/components/Vineyard/DiseaseDetailModal.tsx` — PDF inline-Embed via iframe für Mildiou/Oïdium

---

### Task 1: Wirkstoff-Klassen-Map

**Files:**
- Create: `apps/backend/internal/protection/substance_classes.go`

- [ ] Create the file with the curated map. Use the substance UUIDs from psm.admin.ch that we already encountered (Folpet `683783d6-...`, Cymoxanil `9d9a5c3d-...`, etc.).

```go
package protection

import "github.com/google/uuid"

// SubstanceClass groups active ingredients with similar protection behaviour.
type SubstanceClass struct {
	Name              string  // human-readable label
	BaseProtectDays   float64 // base protection duration in dry weather, no growth dilution
	RainWashoutMm     float64 // precipitation in mm that erodes protection by ~100% (linear)
	RainResistantPct  float64 // baseline resistance — min fraction left after heavy rain (0..1)
	GrowthSensitivity string  // "low" | "medium" | "high"
}

var (
	ClassKontaktKupfer = SubstanceClass{Name: "Kontakt-Kupfer", BaseProtectDays: 7,  RainWashoutMm: 40,  RainResistantPct: 0.00, GrowthSensitivity: "medium"}
	ClassKontaktFolpet = SubstanceClass{Name: "Kontakt-Folpet", BaseProtectDays: 8,  RainWashoutMm: 60,  RainResistantPct: 0.00, GrowthSensitivity: "medium"}
	ClassSchwefel      = SubstanceClass{Name: "Schwefel",       BaseProtectDays: 7,  RainWashoutMm: 100, RainResistantPct: 0.60, GrowthSensitivity: "medium"}
	ClassPenetrant     = SubstanceClass{Name: "Penetrant lokalsystemisch", BaseProtectDays: 10, RainWashoutMm: 80,  RainResistantPct: 0.85, GrowthSensitivity: "low"}
	ClassPhosphonat    = SubstanceClass{Name: "Phosphonate/Fosetyl", BaseProtectDays: 14, RainWashoutMm: 0,  RainResistantPct: 1.00, GrowthSensitivity: "high"}
	ClassStrobilurin   = SubstanceClass{Name: "Strobilurine", BaseProtectDays: 12, RainWashoutMm: 0,  RainResistantPct: 1.00, GrowthSensitivity: "high"}
	ClassTriazol       = SubstanceClass{Name: "Triazole",     BaseProtectDays: 12, RainWashoutMm: 0,  RainResistantPct: 1.00, GrowthSensitivity: "high"}
	ClassSDH           = SubstanceClass{Name: "SDH-Inhibitor (Botrytis)", BaseProtectDays: 14, RainWashoutMm: 0, RainResistantPct: 1.00, GrowthSensitivity: "medium"}
	ClassModernSystem  = SubstanceClass{Name: "Moderne Mildiou-Systemika", BaseProtectDays: 14, RainWashoutMm: 0, RainResistantPct: 1.00, GrowthSensitivity: "high"}
	ClassBio           = SubstanceClass{Name: "Biologisch (Bacillus, Ampelomyces, Saccharomyces)", BaseProtectDays: 5, RainWashoutMm: 30, RainResistantPct: 0.20, GrowthSensitivity: "low"}
)

// SubstanceClassMap maps known PSM substance UUIDs to a protection class.
// Curated from Agroscope/JKI standard literature; values are conservative.
// Unknown substances fall back to ClassNeutral (10 days, no rain erosion).
var SubstanceClassMap = map[uuid.UUID]SubstanceClass{
	// Kupfer
	mustUUID("a9525ef1-c3e3-47d4-818d-886ce105775f"): ClassKontaktKupfer, // Kupferhydroxid
	mustUUID("9b6470f1-f00c-406a-b980-05fceedd9be73"): ClassKontaktKupfer, // Kupferoxychlorid
	mustUUID("31403f9a-bb7f-4a16-bc4c-c9083abdd1ab"): ClassKontaktKupfer, // Kupfer
	mustUUID("4631106a-a3c8-4cac-b176-0589f34dd0b7"): ClassKontaktKupfer, // Bordeaux
	mustUUID("2862e3b1-7857-4bfd-bd1f-91184df4ec54"): ClassKontaktKupfer, // Dreibasisches Kupfersulfat
	// Folpet-/Captan-Klasse
	mustUUID("683783d6-0b1f-43d4-bf12-209fd6e3c693"): ClassKontaktFolpet, // Folpet
	mustUUID("63c58a64-ed05-473a-a71d-1b266552e710"): ClassKontaktFolpet, // Dithianon
	mustUUID("12f5b2cc-d00d-4d7c-8ac0-d60a21edf77c"): ClassKontaktFolpet, // Fluazinam
	// Schwefel
	mustUUID("d95f01f3-9ed2-4d08-92fd-a58af1b5f49f"): ClassSchwefel,      // Schwefel
	// Penetranter lokalsystemisch
	mustUUID("9d9a5c3d-1941-4fc3-9111-1fe4cd86e28b"): ClassPenetrant,     // Cymoxanil
	mustUUID("3016b169-b572-40d0-8a71-4a39ae2cc4f7"): ClassPenetrant,     // Mandipropamid
	mustUUID("905ce62c-691d-415c-8fae-2a273246cdc5"): ClassPenetrant,     // Zoxamid
	// Phosphonate
	mustUUID("002f5c84-8aab-4284-839a-0f979550cd5f"): ClassPhosphonat,    // Aluminiumfosetyl (Fosetyl-Al)
	mustUUID("37ddaf9e-cbb5-4cfd-8929-c46f9e2c1130"): ClassPhosphonat,    // Fosetyl
	mustUUID("df3f9c6a-f39c-430d-ad14-133c0979e6ac"): ClassPhosphonat,    // Kaliumphosphonat
	mustUUID("3e5eef6e-d791-42c7-9aec-5da6cb1163fe"): ClassPhosphonat,    // Aluminiumsulfat / similar
	// Strobilurine
	mustUUID("24e6793b-c9ce-4fd7-98f6-f2bd49090672"): ClassStrobilurin,   // Azoxystrobin
	mustUUID("216523e4-d6c9-4bbd-971d-b1f5520c1a90"): ClassStrobilurin,   // Trifloxystrobin
	mustUUID("634e1b51-7c89-4bab-a320-1cdec4111bb8"): ClassStrobilurin,   // Kresoxim-methyl
	// Triazole
	mustUUID("112f60c6-7c33-4123-9d70-000d29e9d90d"): ClassTriazol,       // Difenoconazol
	// SDH
	// (UUIDs für Boscalid, Fluopyram, Fluxapyroxad würden hier rein — bei Bedarf nachpflegen)
	// Bio
	// (Bacillus, Ampelomyces - UUIDs nachpflegen)
}

var ClassNeutral = SubstanceClass{Name: "Unklassifiziert", BaseProtectDays: 10, RainWashoutMm: 0, RainResistantPct: 1.00, GrowthSensitivity: "medium"}

// ClassesForSpray returns the unique classes of all substances in a spray.
// Unknown substances are mapped to ClassNeutral.
func ClassesForSpray(substanceIDs []uuid.UUID) []SubstanceClass {
	seen := map[string]struct{}{}
	out := []SubstanceClass{}
	for _, id := range substanceIDs {
		c, ok := SubstanceClassMap[id]
		if !ok {
			c = ClassNeutral
		}
		if _, dup := seen[c.Name]; dup {
			continue
		}
		seen[c.Name] = struct{}{}
		out = append(out, c)
	}
	return out
}
```

Run: `cd apps/backend && go build ./internal/protection/...` — must compile.

---

### Task 2: Protection-Duration-Funktion

**Files:**
- Create: `apps/backend/internal/protection/protection_duration.go`
- Create: `apps/backend/internal/protection/protection_duration_test.go`

- [ ] **Step 1: Function**

```go
package protection

import (
	"time"

	"wingert/backend/internal/agrometeo"
)

// EffectiveProtectionDays returns how many days of protection a spray provides
// under the actual conditions (growth phase + rain since application).
// hourly: weather observations from spray.AppliedAt to now. Pass nil/empty if not available.
// bbchStage: phenology BBCH value (0..89). Pass 0 if unknown — assumes neutral.
func EffectiveProtectionDays(classes []SubstanceClass, hourly []agrometeo.HourlyPoint, bbchStage int) float64 {
	if len(classes) == 0 {
		return float64(DefaultSprayProtectionDays)
	}
	// Sum precipitation since spray.
	var precipSinceSpray float64
	for _, p := range hourly {
		precipSinceSpray += p.PrecipMm
	}

	growth := growthFactor(bbchStage)

	// Take the most generous (longest-protecting) class — covers tank mixes
	// where one component provides systemic protection beyond the contact partners.
	best := 0.0
	for _, c := range classes {
		base := c.BaseProtectDays
		// Growth penalty
		switch c.GrowthSensitivity {
		case "high":
			base *= growth.high
		case "medium":
			base *= growth.medium
		default:
			base *= growth.low
		}
		// Rain washout
		base *= rainFactor(precipSinceSpray, c)
		if base > best {
			best = base
		}
	}
	return best
}

type growthFactors struct{ high, medium, low float64 }

// growthFactor returns multipliers for high/medium/low growth-sensitivity classes
// based on BBCH phenology. Lower BBCH = stronger shoot growth = faster dilution.
func growthFactor(bbch int) growthFactors {
	switch {
	case bbch == 0:
		return growthFactors{high: 0.8, medium: 0.9, low: 1.0} // unknown -> mild penalty
	case bbch < 50:
		return growthFactors{high: 0.5, medium: 0.7, low: 0.9}
	case bbch < 70:
		return growthFactors{high: 0.7, medium: 0.85, low: 0.95}
	default:
		return growthFactors{high: 1.0, medium: 1.0, low: 1.0}
	}
}

// rainFactor returns a 0..1 multiplier for the class's protection given the
// total precipitation since the spray.
func rainFactor(precipMm float64, c SubstanceClass) float64 {
	if c.RainWashoutMm == 0 {
		return 1.0 // rain-resistant class
	}
	washout := precipMm / c.RainWashoutMm
	if washout >= 1.0 {
		return c.RainResistantPct
	}
	residual := 1.0 - washout*(1.0-c.RainResistantPct)
	if residual < c.RainResistantPct {
		residual = c.RainResistantPct
	}
	return residual
}

// EffectiveProtectionFraction returns the fraction of protection remaining today.
// days_since: full days between spray.AppliedAt and `now`.
func EffectiveProtectionFraction(effectiveDays, daysSince float64) float64 {
	if effectiveDays <= 0 {
		return 0
	}
	p := 1.0 - daysSince/effectiveDays
	if p < 0 { p = 0 }
	if p > 1 { p = 1 }
	return p
}

// HourlyWeatherSince filters hourly points to those after `since`.
func HourlyWeatherSince(hourly []agrometeo.HourlyPoint, since time.Time) []agrometeo.HourlyPoint {
	out := make([]agrometeo.HourlyPoint, 0, len(hourly))
	for _, p := range hourly {
		if !p.Time.Before(since) {
			out = append(out, p)
		}
	}
	return out
}
```

- [ ] **Step 2: Table-Tests**

```go
package protection_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"wingert/backend/internal/agrometeo"
	"wingert/backend/internal/protection"
)

func TestEffectiveProtectionDays_DryNoGrowthPenalty(t *testing.T) {
	classes := []protection.SubstanceClass{protection.ClassPenetrant} // base 10d, low growth penalty
	d := protection.EffectiveProtectionDays(classes, nil, 75) // post-Blüte
	assert.InDelta(t, 10.0, d, 0.5)
}

func TestEffectiveProtectionDays_GrowthPenaltyPreBloom(t *testing.T) {
	// Strobilurine (12d, high sensitivity) + BBCH 30 = 0.5x = 6d
	classes := []protection.SubstanceClass{protection.ClassStrobilurin}
	d := protection.EffectiveProtectionDays(classes, nil, 30)
	assert.InDelta(t, 6.0, d, 0.5)
}

func TestEffectiveProtectionDays_RainErodesKupfer(t *testing.T) {
	classes := []protection.SubstanceClass{protection.ClassKontaktKupfer} // 7d base, washout at 40mm
	// 20mm rain since spray → halfway-washed → ~50% protection → 3.5d effective
	hourly := []agrometeo.HourlyPoint{
		{Time: time.Now().Add(-12 * time.Hour), PrecipMm: 20.0},
	}
	d := protection.EffectiveProtectionDays(classes, hourly, 75)
	assert.InDelta(t, 3.5, d, 0.5)
}

func TestEffectiveProtectionDays_TankMixLongestWins(t *testing.T) {
	// Kupfer (7d) + Phosphonat (14d, rain-resistant)
	classes := []protection.SubstanceClass{protection.ClassKontaktKupfer, protection.ClassPhosphonat}
	d := protection.EffectiveProtectionDays(classes, nil, 75)
	assert.InDelta(t, 14.0, d, 0.5) // phosphonate wins
}

func TestEffectiveProtectionDays_HeavyRainOnSystemic(t *testing.T) {
	// Phosphonat = rain-resistant, even 50mm doesn't reduce.
	classes := []protection.SubstanceClass{protection.ClassPhosphonat}
	hourly := []agrometeo.HourlyPoint{
		{Time: time.Now().Add(-24 * time.Hour), PrecipMm: 50.0},
	}
	d := protection.EffectiveProtectionDays(classes, hourly, 75)
	assert.InDelta(t, 14.0, d, 0.5)
}

func TestEffectiveProtectionFraction(t *testing.T) {
	assert.InDelta(t, 1.0, protection.EffectiveProtectionFraction(10, 0), 0.001)
	assert.InDelta(t, 0.5, protection.EffectiveProtectionFraction(10, 5), 0.001)
	assert.InDelta(t, 0.0, protection.EffectiveProtectionFraction(10, 15), 0.001)
}
```

Run: `cd apps/backend && go test ./internal/protection/... -run TestEffectiveProtection -timeout 30s -v` — expect all 6 pass.

---

### Task 3: Combinator + Service Integration

**Files:**
- Modify: `apps/backend/internal/protection/combinator.go`
- Modify: `apps/backend/internal/protection/service.go`

- [ ] **Step 1:** Combinator gets new parameters

Change `Combine` signature to accept the protection-duration values:

```go
func Combine(d Disease, raw agrometeo.ModelFeature,
    spray *domain.SprayApplication, period *domain.ProtectionPeriod,
    now time.Time,
    sprayProtectionDays float64, // 0 means: use DefaultSprayProtectionDays as fallback
) DiseaseResult {
```

Inside the `MeasureSpray` branch, replace the formula:

```go
case MeasureSpray:
    if spray != nil && targetMatches(spray.TargetPestIDs, d.PSMPestIDs) {
        days := now.Sub(spray.AppliedAt).Hours() / 24
        protectDays := sprayProtectionDays
        if protectDays <= 0 {
            protectDays = float64(DefaultSprayProtectionDays)
        }
        protection := EffectiveProtectionFraction(protectDays, days)
        effective := rawIdx * (1 - protection)
        res.EffectiveIndex = effective
        res.EffectiveLevel = MapLevel(d, effective)
        res.MeasureType = MeasureSpray
        t := spray.AppliedAt
        res.LastMeasureAt = &t
        res.ProtectionDaysTotal = protectDays
        res.ProtectionDaysRemaining = math.Max(0, protectDays - days)
        res.Recommendation = recommendSpray(d, res.EffectiveLevel, int(days))
        return res
    }
    res.Recommendation = recommendSpray(d, rawLevel, -1)
```

Add fields to DiseaseResult:

```go
ProtectionDaysTotal     float64 `json:"protectionDaysTotal,omitempty"`
ProtectionDaysRemaining float64 `json:"protectionDaysRemaining,omitempty"`
```

Imports: `math`.

Also update the second Combine-call in service.go (the recent-max escalation path) to pass the same protectDays.

- [ ] **Step 2:** Service computes `sprayProtectionDays` from spray + bbch + hourly weather

In `service.go` `Compute`, after `relevantSpray` is determined:

```go
sprayProtectDays := 0.0
if relevantSpray != nil {
    classes := ClassesForSpray(relevantSpray.SubstanceIDs)
    bbch := 0
    if out.Phenology != nil {
        bbch = int(out.Phenology.RawIndex)
    }
    since := HourlyWeatherSince(hourlyForDuration, relevantSpray.AppliedAt)
    sprayProtectDays = EffectiveProtectionDays(classes, since, bbch)
}

res := Combine(d, feature, relevantSpray, period, time.Now(), sprayProtectDays)
```

For `hourlyForDuration`: Compute already fetches hourly weather for the spray window. We can extend the from-date back to cover the longest possible spray-vs-now window — `today.AddDate(0, 0, -21)` (longest base = 14, with margin). Refetch needs new query: `s.agro.FetchHourlyWeather(ctx, nearest.ID, today.AddDate(0, 0, -21), today.AddDate(0, 0, 3))`.

Actually simpler: in Compute, fetch hourly once for the larger range and reuse for both spray window finder and duration calculation:

```go
hourlyFrom := today.AddDate(0, 0, -21)
hourlyTo := today.AddDate(0, 0, 3)
hourly, _ := s.agro.FetchHourlyWeather(ctx, nearest.ID, hourlyFrom, hourlyTo)
```

Then split: pass `hourly` filtered after-spray-date to the duration calc, pass `hourly` filtered after-now to the spray-window finder.

This means a longer hourly fetch on every Compute call. With Agrometeo's cache and short response, acceptable.

- [ ] **Step 3:** Update tests using `Combine`

`combinator_test.go` calls `Combine` with 5 args — change to 6 (pass `0` for `sprayProtectionDays` to keep using default-12 behaviour):

```go
res := protection.Combine(d, raw, nil, nil, time.Now(), 0)
```

Run: `cd apps/backend && go build ./... && go test ./internal/protection/... -timeout 60s` — all pass.

---

### Task 4: Frontend types + Card UI

**Files:**
- Modify: `apps/frontend/src/types/index.ts`
- Modify: `apps/frontend/src/components/Vineyard/DiseaseCard.tsx`

- [ ] **Step 1:** Types

```ts
export interface DiseaseResult {
  // existing fields …
  protectionDaysTotal?: number
  protectionDaysRemaining?: number
}
```

- [ ] **Step 2:** Card renders mini-bar

In DiseaseCard, between the index-label/trend row and the recommendation, add:

```tsx
{disease.protectionDaysRemaining != null && disease.protectionDaysTotal != null && disease.protectionDaysTotal > 0 && (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
    <Typography variant="caption" color="text.secondary">
      Schutz: {disease.protectionDaysRemaining.toFixed(0)} / {disease.protectionDaysTotal.toFixed(0)} Tage
    </Typography>
    <Box sx={{ flex: 1, height: 4, bgcolor: 'action.hover', borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{
        height: '100%',
        width: `${Math.min(100, (disease.protectionDaysRemaining / disease.protectionDaysTotal) * 100)}%`,
        bgcolor: disease.protectionDaysRemaining > 3 ? 'success.main' : 'warning.main',
      }} />
    </Box>
  </Box>
)}
```

Run: `cd apps/frontend && pnpm lint && pnpm test -- --run && pnpm build` — green.

---

### Task 5: PDF inline embed

**Files:**
- Modify: `apps/frontend/src/components/Vineyard/DiseaseDetailModal.tsx`

- [ ] **Step 1:** Replace the existing PDF link block with an attempt-iframe-then-fallback-link pattern.

Replace:

```tsx
{(disease.key === 'mildiou' || disease.key === 'oidium') && data && (
  <Box sx={{ mb: 1 }}>
    <Link href={...} target="_blank" ...>
      📄 Offizieller Detailbericht inkl. Biologie-Kurve (PDF, agrometeo.ch) →
    </Link>
  </Box>
)}
```

With:

```tsx
{(disease.key === 'mildiou' || disease.key === 'oidium') && data && (
  <PdfReportInline
    href={`https://api.agrometeo.ch/${disease.key}/stations/${data.stationId}/report`}
  />
)}
```

Add this small component above `DiseaseDetailModal` (same file):

```tsx
function PdfReportInline({ href }: { href: string }) {
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)
  // Most browsers honour X-Frame-Options; if agrometeo doesn't allow embedding,
  // the iframe loads empty. We can't reliably detect that, so we show both:
  // a toggle to expand the iframe + an explicit "open in new tab" link.
  return (
    <Box sx={{ mb: 1 }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Link
          component="button"
          variant="caption"
          onClick={() => setOpen((v) => !v)}
        >
          📄 Detailbericht inkl. Biologie-Kurve {open ? 'einklappen' : 'einblenden'}
        </Link>
        <Link href={href} target="_blank" rel="noopener noreferrer" variant="caption">
          (oder in neuem Tab öffnen)
        </Link>
      </Box>
      {open && !failed && (
        <Box sx={{ mt: 1, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
          <iframe
            src={href}
            title="Agrometeo Detailbericht"
            style={{ width: '100%', height: 600, border: 'none' }}
            onError={() => setFailed(true)}
          />
        </Box>
      )}
      {failed && (
        <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
          Inline-Darstellung von agrometeo.ch blockiert. Bitte über den Link in neuem Tab öffnen.
        </Typography>
      )}
    </Box>
  )
}
```

Add `useState` to imports if needed.

Run: `cd apps/frontend && pnpm lint && pnpm test -- --run && pnpm build` — green.

---

### Task 6: Mobile BottomNav bekommt eigene Pflanzenschutz-Kachel

**Files:**
- Modify: `apps/frontend/src/components/Layout/MobileLayout.tsx`

- [ ] **Step 1:** BottomNav von 4 auf 5 Slots erweitern: Weinberge / Pflanzenschutz / Aufgaben / Auswertungen / Einstellungen.

```tsx
const tabToSlot: Record<number, number> = { 0: 0, 6: 1, 1: 2, 2: 3, 3: 4, 4: 4, 5: 4 }
const slotToTab: Record<number, number> = { 0: 0, 1: 6, 2: 1, 3: 2, 4: 3 }
```

Update `bottomNavValue` und `handleNavChange` entsprechend (Settings group bleibt im Slot 4).

- [ ] **Step 2:** Sub-Nav unter Weinberge wieder entfernen (Pflanzenschutz hat jetzt eigene BottomNav-Kachel).

- [ ] **Step 3:** `BottomNavigationAction label="Pflanzenschutz" icon={<HealthAndSafetyIcon />}` als zweites Item einfügen.

Run: `pnpm lint && pnpm build` — clean.

(Bereits implementiert während des Plan-Schreibens.)

---

## Self-Review

**Spec coverage:**
- Wirkstoff-Klassen-Map: Task 1
- Wachstums-Faktor: Task 2 (`growthFactor`)
- Regen-Erosion: Task 2 (`rainFactor`)
- Combinator-Integration: Task 3
- Card-UI "Schutz X/Y Tage": Task 4
- PDF-Inline-Embed: Task 5

**Risks:**
- The substance UUID map is curated — some BLV substances are missing (notably Botrytis SDH-Inhibitoren and bio). Unknown substances fall back to `ClassNeutral` (10 days, rain-resistant) which is a conservative default. Manageable — extend the map over time.
- Tankmischungs-Logik = "längste Klasse gewinnt" — vereinfacht. In Realität haben kombinierte Wirkstoffe additive Effekte. Konservativ aber praktikabel.
- iframe-Embed: Agrometeo könnte `X-Frame-Options: DENY` setzen, dann lädt das iframe leer ohne klare Fehlermeldung. Der Link bleibt als verlässlicher Fallback sichtbar.
- Eine Compute-Aufruf macht jetzt einen weiteren Hourly-Fetch über 24 Tage statt nur über 3 — minimal mehr Bandbreite, gleich gecacht.

---

**Execution:** Use subagent-driven-development with one subagent per task.
