package store

import (
	"github.com/google/uuid"
	"github.com/lib/pq"
	"gorm.io/gorm"
	"wingert/backend/internal/domain"
)

const rebenCultureID = "2314eb9f-7207-409f-a0d4-89b6a1177363"

type PSMStore struct{ db *gorm.DB }

func NewPSMStore(db *gorm.DB) *PSMStore { return &PSMStore{db: db} }

func (s *PSMStore) UpsertBatch(b domain.PSMBatch) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		for _, sub := range b.Substances {
			if err := tx.Exec(`
				INSERT INTO psm_substances (id, name_de, name_fr, name_it, synced_at)
				VALUES (?, ?, ?, ?, ?)
				ON CONFLICT (id) DO UPDATE SET
					name_de   = EXCLUDED.name_de,
					name_fr   = EXCLUDED.name_fr,
					name_it   = EXCLUDED.name_it,
					synced_at = EXCLUDED.synced_at`,
				sub.ID, sub.NameDE, sub.NameFR, sub.NameIT, b.SyncedAt).Error; err != nil {
				return err
			}
		}
		for _, p := range b.Pests {
			if err := tx.Exec(`
				INSERT INTO psm_pests (id, name_de, name_fr, name_it, synced_at)
				VALUES (?, ?, ?, ?, ?)
				ON CONFLICT (id) DO UPDATE SET
					name_de=EXCLUDED.name_de, name_fr=EXCLUDED.name_fr,
					name_it=EXCLUDED.name_it, synced_at=EXCLUDED.synced_at`,
				p.ID, p.NameDE, p.NameFR, p.NameIT, b.SyncedAt).Error; err != nil {
				return err
			}
		}
		for _, p := range b.Products {
			if err := tx.Exec(`
				INSERT INTO psm_products (id, w_nbr, name, is_parallel_import,
					exhaustion_deadline, soldout_deadline, synced_at)
				VALUES (?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT (id) DO UPDATE SET
					w_nbr=EXCLUDED.w_nbr, name=EXCLUDED.name,
					is_parallel_import=EXCLUDED.is_parallel_import,
					exhaustion_deadline=EXCLUDED.exhaustion_deadline,
					soldout_deadline=EXCLUDED.soldout_deadline,
					synced_at=EXCLUDED.synced_at`,
				p.ID, p.WNbr, p.Name, p.IsParallelImport,
				p.ExhaustionDeadline, p.SoldoutDeadline, b.SyncedAt).Error; err != nil {
				return err
			}
			if err := tx.Exec(`DELETE FROM psm_product_substances WHERE product_id = ?`, p.ID).Error; err != nil {
				return err
			}
			if err := tx.Exec(`DELETE FROM psm_indications WHERE product_id = ?`, p.ID).Error; err != nil {
				return err
			}
		}
		for _, ps := range b.ProductSubstances {
			if err := tx.Exec(`
				INSERT INTO psm_product_substances (product_id, substance_id, in_percent, in_gramm_per_litre)
				VALUES (?, ?, ?, ?)
				ON CONFLICT (product_id, substance_id) DO UPDATE SET
					in_percent         = COALESCE(EXCLUDED.in_percent, psm_product_substances.in_percent),
					in_gramm_per_litre = COALESCE(EXCLUDED.in_gramm_per_litre, psm_product_substances.in_gramm_per_litre)`,
				ps.ProductID, ps.SubstanceID, ps.InPercent, ps.InGrammPerLitre).Error; err != nil {
				return err
			}
		}
		for _, ind := range b.Indications {
			if err := tx.Exec(`
				INSERT INTO psm_indications (product_id, pest_id, culture_id,
					dosage_from, dosage_to, dosage_unit, waiting_period_days,
					application_area, expenditure_form)
				VALUES (?, ?, ?::uuid, ?, ?, ?, ?, ?, ?)`,
				ind.ProductID, ind.PestID, rebenCultureID,
				ind.DosageFrom, ind.DosageTo, ind.DosageUnit, ind.WaitingPeriodDays,
				ind.ApplicationArea, "").Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *PSMStore) SearchProducts(q string, limit int) ([]domain.PSMProduct, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	var rows []struct {
		ID   string
		WNbr string `gorm:"column:w_nbr"`
		Name string
	}
	pattern := "%" + q + "%"
	err := s.db.Raw(`
		SELECT id, w_nbr, name FROM psm_products
		WHERE name ILIKE ?
		ORDER BY similarity(name, ?) DESC, name ASC
		LIMIT ?`, pattern, q, limit).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]domain.PSMProduct, len(rows))
	for i, r := range rows {
		out[i] = domain.PSMProduct{ID: r.ID, WNbr: r.WNbr, Name: r.Name}
	}
	return out, nil
}

func (s *PSMStore) GetProduct(id string) (*domain.PSMProduct, error) {
	var head struct {
		ID               string
		WNbr             string `gorm:"column:w_nbr"`
		Name             string
		IsParallelImport bool `gorm:"column:is_parallel_import"`
	}
	err := s.db.Raw(`
		SELECT id, w_nbr, name, is_parallel_import FROM psm_products WHERE id = ?`, id).Scan(&head).Error
	if err != nil {
		return nil, err
	}
	if head.ID == "" {
		return nil, nil
	}
	p := &domain.PSMProduct{
		ID: head.ID, WNbr: head.WNbr, Name: head.Name, IsParallelImport: head.IsParallelImport,
	}

	var subs []struct {
		ID     uuid.UUID
		NameDE string `gorm:"column:name_de"`
	}
	if err := s.db.Raw(`
		SELECT s.id, s.name_de FROM psm_substances s
		JOIN psm_product_substances ps ON ps.substance_id = s.id
		WHERE ps.product_id = ?
		ORDER BY s.name_de`, id).Scan(&subs).Error; err != nil {
		return nil, err
	}
	for _, s2 := range subs {
		p.Substances = append(p.Substances, domain.PSMSubstance{ID: s2.ID, NameDE: s2.NameDE})
	}

	var inds []struct {
		ID                int64
		PestID            uuid.UUID `gorm:"column:pest_id"`
		PestName          string    `gorm:"column:pest_name"`
		DosageFrom        *float64  `gorm:"column:dosage_from"`
		DosageTo          *float64  `gorm:"column:dosage_to"`
		DosageUnit        string    `gorm:"column:dosage_unit"`
		WaitingPeriodDays *int      `gorm:"column:waiting_period_days"`
	}
	if err := s.db.Raw(`
		SELECT i.id, i.pest_id, p.name_de AS pest_name, i.dosage_from, i.dosage_to,
		       i.dosage_unit, i.waiting_period_days
		FROM psm_indications i
		JOIN psm_pests p ON p.id = i.pest_id
		WHERE i.product_id = ?
		ORDER BY p.name_de, i.id`, id).Scan(&inds).Error; err != nil {
		return nil, err
	}
	for _, in := range inds {
		p.Indications = append(p.Indications, domain.PSMIndication{
			ID: in.ID, ProductID: id, PestID: in.PestID, PestName: in.PestName,
			DosageFrom: in.DosageFrom, DosageTo: in.DosageTo, DosageUnit: in.DosageUnit,
			WaitingPeriodDays: in.WaitingPeriodDays,
		})
	}
	return p, nil
}

func (s *PSMStore) SearchSubstances(q string, limit int) ([]domain.PSMSubstance, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	var rows []struct {
		ID     uuid.UUID
		NameDE string `gorm:"column:name_de"`
	}
	err := s.db.Raw(`
		SELECT id, name_de FROM psm_substances
		WHERE name_de ILIKE ?
		ORDER BY name_de ASC
		LIMIT ?`, "%"+q+"%", limit).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]domain.PSMSubstance, len(rows))
	for i, r := range rows {
		out[i] = domain.PSMSubstance{ID: r.ID, NameDE: r.NameDE}
	}
	return out, nil
}

func (s *PSMStore) GetPestsForSubstances(substanceIDs []uuid.UUID) ([]uuid.UUID, error) {
	if len(substanceIDs) == 0 {
		return nil, nil
	}
	var ids []uuid.UUID
	err := s.db.Raw(`
		SELECT DISTINCT i.pest_id
		FROM psm_indications i
		JOIN psm_product_substances ps ON ps.product_id = i.product_id
		WHERE ps.substance_id = ANY(?)`,
		pq.Array(substanceIDs)).Scan(&ids).Error
	if err != nil {
		return nil, err
	}
	return ids, nil
}

func (s *PSMStore) Meta() (*domain.PSMSyncMeta, error) {
	var m domain.PSMSyncMeta
	err := s.db.Raw(`SELECT last_sync_at, source_publication_date, product_count, status, error_message
		FROM psm_sync_meta WHERE id = 1`).Scan(&m).Error
	if err != nil {
		return nil, err
	}
	if m.LastSyncAt.IsZero() {
		return nil, nil
	}
	return &m, nil
}

func (s *PSMStore) SetMeta(m domain.PSMSyncMeta) error {
	return s.db.Exec(`
		INSERT INTO psm_sync_meta (id, last_sync_at, source_publication_date, product_count, status, error_message)
		VALUES (1, ?, ?, ?, ?, ?)
		ON CONFLICT (id) DO UPDATE SET
			last_sync_at=EXCLUDED.last_sync_at,
			source_publication_date=EXCLUDED.source_publication_date,
			product_count=EXCLUDED.product_count,
			status=EXCLUDED.status,
			error_message=EXCLUDED.error_message`,
		m.LastSyncAt, m.SourcePublicationDate, m.ProductCount, m.Status, m.ErrorMessage).Error
}
