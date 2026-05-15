package domain

import (
	"time"

	"github.com/google/uuid"
)

type SprayApplication struct {
	TaskID        uuid.UUID   `json:"taskId"`
	ProductIDs    []string    `json:"productIds,omitempty"`
	ProductNames  []string    `json:"productNames,omitempty"`
	SubstanceIDs  []uuid.UUID `json:"substanceIds"`
	TargetPestIDs []uuid.UUID `json:"targetPestIds,omitempty"`
	Dosage        *float64    `json:"dosage,omitempty"`
	DosageUnit    string      `json:"dosageUnit,omitempty"`
	AppliedAt     time.Time   `json:"appliedAt"`
	Notes         string      `json:"notes,omitempty"`
}

type ProtectionPeriodKind string

const (
	ProtectionPeriodDispenser   ProtectionPeriodKind = "dispenser"
	ProtectionPeriodMowingPause ProtectionPeriodKind = "mowing-pause"
)

type ProtectionPeriod struct {
	ID            uuid.UUID            `json:"id"`
	VineyardID    uuid.UUID            `json:"vineyardId"`
	Kind          ProtectionPeriodKind `json:"kind"`
	StartTaskID   uuid.UUID            `json:"startTaskId"`
	EndTaskID     *uuid.UUID           `json:"endTaskId,omitempty"`
	StartAt       time.Time            `json:"startAt"`
	EndAt         *time.Time           `json:"endAt,omitempty"`
	TargetPestIDs []uuid.UUID          `json:"targetPestIds"`
}

type SprayRepository interface {
	Create(s SprayApplication) error
	FindByVineyard(vineyardID uuid.UUID, since time.Time) ([]SprayApplication, error)
}

type ProtectionPeriodRepository interface {
	Create(p ProtectionPeriod) error
	FindActive(vineyardID uuid.UUID, kind ProtectionPeriodKind) (*ProtectionPeriod, error)
	CloseLatest(vineyardID uuid.UUID, kind ProtectionPeriodKind, endTaskID uuid.UUID, endAt time.Time) error
	// LatestMaehenTask returns the created_at timestamp of the most recent
	// "maehen" subtype task for the vineyard, or nil if none exists.
	LatestMaehenTask(vineyardID uuid.UUID) (*time.Time, error)
}
