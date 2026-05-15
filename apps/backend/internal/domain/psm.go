package domain

import (
	"time"

	"github.com/google/uuid"
)

type PSMSubstance struct {
	ID     uuid.UUID `json:"id"`
	NameDE string    `json:"nameDe"`
	NameFR *string   `json:"nameFr,omitempty"`
	NameIT *string   `json:"nameIt,omitempty"`
}

type PSMPest struct {
	ID     uuid.UUID `json:"id"`
	NameDE string    `json:"nameDe"`
	NameFR *string   `json:"nameFr,omitempty"`
	NameIT *string   `json:"nameIt,omitempty"`
}

type PSMProduct struct {
	ID                 string          `json:"id"`
	WNbr               string          `json:"wNbr"`
	Name               string          `json:"name"`
	IsParallelImport   bool            `json:"isParallelImport"`
	ExhaustionDeadline *time.Time      `json:"exhaustionDeadline,omitempty"`
	SoldoutDeadline    *time.Time      `json:"soldoutDeadline,omitempty"`
	Substances         []PSMSubstance  `json:"substances,omitempty"`
	Indications        []PSMIndication `json:"indications,omitempty"`
}

type PSMIndication struct {
	ID                int64     `json:"id"`
	ProductID         string    `json:"productId"`
	PestID            uuid.UUID `json:"pestId"`
	PestName          string    `json:"pestName,omitempty"`
	DosageFrom        *float64  `json:"dosageFrom,omitempty"`
	DosageTo          *float64  `json:"dosageTo,omitempty"`
	DosageUnit        string    `json:"dosageUnit,omitempty"`
	WaitingPeriodDays *int      `json:"waitingPeriodDays,omitempty"`
	ApplicationArea   string    `json:"applicationArea,omitempty"`
}

type PSMSyncMeta struct {
	LastSyncAt            time.Time  `json:"lastSyncAt"`
	SourcePublicationDate *time.Time `json:"sourcePublicationDate,omitempty"`
	ProductCount          int        `json:"productCount"`
	Status                string     `json:"status"`
	ErrorMessage          string     `json:"errorMessage,omitempty"`
}

type PSMProductSubstance struct {
	ProductID       string
	SubstanceID     uuid.UUID
	InPercent       *float64
	InGrammPerLitre *float64
}

// PSMBatch is one full upsert payload produced by the XML parser.
type PSMBatch struct {
	Substances        []PSMSubstance
	Pests             []PSMPest
	Products          []PSMProduct
	ProductSubstances []PSMProductSubstance
	Indications       []PSMIndication
	SyncedAt          time.Time
}

// PSMRepository is the persistence abstraction used by handlers and services.
type PSMRepository interface {
	SearchProducts(q string, limit int) ([]PSMProduct, error)
	GetProduct(id string) (*PSMProduct, error)
	SearchSubstances(q string, limit int) ([]PSMSubstance, error)
	GetPestsForSubstances(substanceIDs []uuid.UUID) ([]uuid.UUID, error)
	UpsertBatch(b PSMBatch) error
	Meta() (*PSMSyncMeta, error)
	SetMeta(m PSMSyncMeta) error
}
