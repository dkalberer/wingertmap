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
	ClassKontaktKupfer = SubstanceClass{Name: "Kontakt-Kupfer", BaseProtectDays: 7, RainWashoutMm: 40, RainResistantPct: 0.00, GrowthSensitivity: "medium"}
	ClassKontaktFolpet = SubstanceClass{Name: "Kontakt-Folpet", BaseProtectDays: 8, RainWashoutMm: 60, RainResistantPct: 0.00, GrowthSensitivity: "medium"}
	ClassSchwefel      = SubstanceClass{Name: "Schwefel", BaseProtectDays: 7, RainWashoutMm: 100, RainResistantPct: 0.60, GrowthSensitivity: "medium"}
	ClassPenetrant     = SubstanceClass{Name: "Penetrant lokalsystemisch", BaseProtectDays: 10, RainWashoutMm: 80, RainResistantPct: 0.85, GrowthSensitivity: "low"}
	ClassPhosphonat    = SubstanceClass{Name: "Phosphonate/Fosetyl", BaseProtectDays: 14, RainWashoutMm: 0, RainResistantPct: 1.00, GrowthSensitivity: "high"}
	ClassStrobilurin   = SubstanceClass{Name: "Strobilurine", BaseProtectDays: 12, RainWashoutMm: 0, RainResistantPct: 1.00, GrowthSensitivity: "high"}
	ClassTriazol       = SubstanceClass{Name: "Triazole", BaseProtectDays: 12, RainWashoutMm: 0, RainResistantPct: 1.00, GrowthSensitivity: "high"}
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
	mustUUID("9b6470f1-f00c-406a-b980-05fceedd9be7"): ClassKontaktKupfer, // Kupferoxychlorid
	mustUUID("31403f9a-bb7f-4a16-bc4c-c9083abdd1ab"): ClassKontaktKupfer, // Kupfer
	mustUUID("4631106a-a3c8-4cac-b176-0589f34dd0b7"): ClassKontaktKupfer, // Bordeaux
	mustUUID("2862e3b1-7857-4bfd-bd1f-91184df4ec54"): ClassKontaktKupfer, // Dreibasisches Kupfersulfat
	// Folpet-/Captan-Klasse
	mustUUID("683783d6-0b1f-43d4-bf12-209fd6e3c693"): ClassKontaktFolpet, // Folpet
	mustUUID("63c58a64-ed05-473a-a71d-1b266552e710"): ClassKontaktFolpet, // Dithianon
	mustUUID("12f5b2cc-d00d-4d7c-8ac0-d60a21edf77c"): ClassKontaktFolpet, // Fluazinam
	// Schwefel
	mustUUID("d95f01f3-9ed2-4d08-92fd-a58af1b5f49f"): ClassSchwefel, // Schwefel
	// Penetranter lokalsystemisch
	mustUUID("9d9a5c3d-1941-4fc3-9111-1fe4cd86e28b"): ClassPenetrant, // Cymoxanil
	mustUUID("3016b169-b572-40d0-8a71-4a39ae2cc4f7"): ClassPenetrant, // Mandipropamid
	mustUUID("905ce62c-691d-415c-8fae-2a273246cdc5"): ClassPenetrant, // Zoxamid
	// Phosphonate
	mustUUID("002f5c84-8aab-4284-839a-0f979550cd5f"): ClassPhosphonat, // Aluminiumfosetyl (Fosetyl-Al)
	mustUUID("37ddaf9e-cbb5-4cfd-8929-c46f9e2c1130"): ClassPhosphonat, // Fosetyl
	mustUUID("df3f9c6a-f39c-430d-ad14-133c0979e6ac"): ClassPhosphonat, // Kaliumphosphonat
	mustUUID("3e5eef6e-d791-42c7-9aec-5da6cb1163fe"): ClassPhosphonat, // Aluminiumsulfat / similar
	// Strobilurine
	mustUUID("24e6793b-c9ce-4fd7-98f6-f2bd49090672"): ClassStrobilurin, // Azoxystrobin
	mustUUID("216523e4-d6c9-4bbd-971d-b1f5520c1a90"): ClassStrobilurin, // Trifloxystrobin
	mustUUID("634e1b51-7c89-4bab-a320-1cdec4111bb8"): ClassStrobilurin, // Kresoxim-methyl
	// Triazole
	mustUUID("112f60c6-7c33-4123-9d70-000d29e9d90d"): ClassTriazol, // Difenoconazol
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
