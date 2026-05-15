package protection

import "github.com/google/uuid"

const (
	RebenCultureID             = "2314eb9f-7207-409f-a0d4-89b6a1177363"
	DefaultSprayProtectionDays = 12
)

type MeasureType string

const (
	MeasureSpray       MeasureType = "spray"
	MeasureDispenser   MeasureType = "dispenser"
	MeasureMowingPause MeasureType = "mowing-pause"
	MeasureInfoOnly    MeasureType = ""
)

type ThresholdRule struct {
	YellowAt float64
	RedAt    float64
	UseField string // "" (index) | "risikolevel" | "risikostufe"
}

type Disease struct {
	Key              string
	Name             string
	AgrometeoModelID int
	PSMPestIDs       []uuid.UUID
	Measure          MeasureType
	Thresholds       ThresholdRule
	InCardAggregate  bool   // whether to include in vineyard-list worst-of badge
	InfoURL          string
	IndexUnit        string // short label for the index value, e.g. "Gradstunden" or "%"
	IndexHelp        string // one-sentence explanation of what the index measures
	IncubationDays   int    // 0 = no lookback; >0 means look back N days for infection events that may still be incubating
}

func mustUUID(s string) uuid.UUID { return uuid.MustParse(s) }

var Diseases = []Disease{
	{Key: "mildiou", Name: "Falscher Mehltau", AgrometeoModelID: 7,
		PSMPestIDs: []uuid.UUID{mustUUID("0251feea-4e71-4881-8b0a-09874f39277a")},
		Measure: MeasureSpray, Thresholds: ThresholdRule{YellowAt: 50, RedAt: 100},
		InCardAggregate: true,
		IndexUnit:       "Gradstunden",
		IndexHelp:       "Plasmopara-Infektionsschwere nach VitiMeteo. 0 = keine Infektion, 50-100 = schwach, 100-200 = mittel, >200 = stark.",
		IncubationDays:  10,
	},
	{Key: "oidium", Name: "Echter Mehltau", AgrometeoModelID: 8,
		PSMPestIDs: []uuid.UUID{mustUUID("9060aec1-f131-4c7e-ab10-40bafec297b3")},
		Measure: MeasureSpray, Thresholds: ThresholdRule{YellowAt: 34, RedAt: 67},
		InCardAggregate: true,
		IndexUnit:       "%",
		IndexHelp:       "Oidium-Risiko nach Agroscope-Modell in Prozent. 0-33 = gering, 34-66 = mittel, 67-100 = hoch.",
		IncubationDays:  7,
	},
	{Key: "black-rot", Name: "Schwarzfäule", AgrometeoModelID: 11,
		PSMPestIDs: []uuid.UUID{mustUUID("0827836e-3719-423d-9340-5413debc42b4")},
		Measure: MeasureSpray, Thresholds: ThresholdRule{YellowAt: 85, RedAt: 150},
		InCardAggregate: true,
		IndexUnit:       "Gradstunden",
		IndexHelp:       "Guignardia-bidwellii-Infektionsschwere. <85 = keine Infektion, 85-300 = mittel, >300 = stark.",
		IncubationDays:  14,
	},
	{Key: "botrytis", Name: "Graufäule (Botrytis)", AgrometeoModelID: 15,
		PSMPestIDs: []uuid.UUID{mustUUID("02ee16ea-7294-4d6d-aa3d-4a3ae7d5f6df")},
		Measure: MeasureSpray, Thresholds: ThresholdRule{YellowAt: 50, RedAt: 100},
		InCardAggregate: true,
		IndexUnit:       "",
		IndexHelp:       "Botrytis-cinerea-Modell. Saisonal aktiv (typisch ab Reifebeginn).",
		IncubationDays:  7,
	},
	{Key: "acariose", Name: "Kräuselmilbe", AgrometeoModelID: 12,
		PSMPestIDs: []uuid.UUID{mustUUID("204c2b56-cc1a-435d-b9ea-c493d9eb5115")},
		Measure: MeasureSpray, Thresholds: ThresholdRule{YellowAt: 300, RedAt: 550},
		InCardAggregate: true,
		IndexUnit:       "°C-Tage",
		IndexHelp:       "Temperatursumme für Calepitrimerus-vitis-Wanderung. <300 = keine Wanderung, 300-550 = Behandlung möglich, >550 = ausserhalb Behandlungsfenster.",
		IncubationDays:  0,
	},
	{Key: "traubenwickler", Name: "Traubenwickler", AgrometeoModelID: 16,
		PSMPestIDs: []uuid.UUID{
			mustUUID("884fbf9b-a098-4936-9caa-57056026d69e"),
			mustUUID("5ac77f67-4abf-460f-825c-a82d635bda38"),
			mustUUID("711c42ab-e781-4501-b0f4-cfbbdc89c83f"),
		},
		// Risikolevel is a discrete integer scale: 1=grün, 2=gelb, 3=rot.
		// RedAt=2.5 ensures level 3 maps to rot with the inclusive <= comparison.
		Measure: MeasureDispenser, Thresholds: ThresholdRule{YellowAt: 2, RedAt: 2.5, UseField: "risikolevel"},
		InCardAggregate: false,
		IndexUnit:       "Risikolevel",
		IndexHelp:       "Lobesia/Eupoecilia-Flugphase (Tempsumme). 1 = kein Risiko, 2 = Vorwarnung (Fallen aufstellen), 3 = 1. Flug möglich, 4 = 1. Flug aktiv, 5 = 2. Flug aktiv.",
	},
	{Key: "bois-noir", Name: "Vergilbungskrankheit", AgrometeoModelID: 9,
		PSMPestIDs: []uuid.UUID{mustUUID("41fc4719-6f5e-49af-80aa-a3f1f687e689")},
		Measure: MeasureMowingPause, Thresholds: ThresholdRule{YellowAt: 80, RedAt: 100},
		InCardAggregate: false,
		IndexUnit:       "%",
		IndexHelp:       "Brennnessel-Temperatursumme als Indikator für Scaphoideus-titanus-Aktivität. Bei 100% Brennnesseln nicht mähen (Vektor-Schutz).",
	},
	{Key: "phenologie", Name: "Phänologie", AgrometeoModelID: 14,
		Measure: MeasureInfoOnly, Thresholds: ThresholdRule{},
		InCardAggregate: false,
		IndexUnit:       "BBCH",
		IndexHelp:       "Phänologisches Entwicklungsstadium der Reben nach BBCH-Skala.",
	},
}

func DiseaseByKey(key string) *Disease {
	for i := range Diseases {
		if Diseases[i].Key == key {
			return &Diseases[i]
		}
	}
	return nil
}
