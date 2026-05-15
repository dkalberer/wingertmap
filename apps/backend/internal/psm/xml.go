package psm

import (
	"encoding/xml"
	"io"
	"strconv"
	"time"

	"github.com/google/uuid"
	"wingert/backend/internal/domain"
)

// ParseXML reads the BLV PublicationData XML and returns a PSMBatch
// containing only entities relevant to the given culture (e.g. Reben).
//
// Two-pass approach: the XML has 22 MetaData sections that are not
// name-distinguishable — they all contain <Detail primaryKey="..."> entries.
// Pass 1 collects products + indications + ingredients that target the given
// culture, recording the substance and pest IDs they reference. Pass 2 re-reads
// the XML and picks Detail rows whose primaryKey matches a referenced ID,
// classifying them as substance- or pest-metadata accordingly.
func ParseXML(r io.ReadSeeker, targetCultureID string) (domain.PSMBatch, error) {
	var batch domain.PSMBatch

	targetCulture, err := uuid.Parse(targetCultureID)
	if err != nil {
		return batch, err
	}

	referencedSubstances := map[uuid.UUID]struct{}{}
	referencedPests := map[uuid.UUID]struct{}{}

	// ── Pass 1: products + indications + ingredients ────────────────────
	if _, err := r.Seek(0, io.SeekStart); err != nil {
		return batch, err
	}
	dec := xml.NewDecoder(r)
	for {
		tok, err := dec.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return batch, err
		}
		se, ok := tok.(xml.StartElement)
		if !ok {
			continue
		}
		if se.Name.Local != "Product" && se.Name.Local != "Parallelimport" {
			continue
		}

		var p xmlProduct
		if err := dec.DecodeElement(&p, &se); err != nil {
			return batch, err
		}
		if !productTargetsCulture(p, targetCulture) {
			continue
		}
		isParallel := se.Name.Local == "Parallelimport"
		batch.Products = append(batch.Products, domain.PSMProduct{
			ID:                 p.ID,
			WNbr:               p.WNbr,
			Name:               p.Name,
			IsParallelImport:   isParallel,
			ExhaustionDeadline: parseDate(p.ExhaustionDeadline),
			SoldoutDeadline:    parseDate(p.SoldoutDeadline),
		})
		for _, ing := range p.ProductInformation.Ingredients {
			for _, sub := range ing.Substances {
				sid, err := uuid.Parse(sub.PrimaryKey)
				if err != nil {
					continue
				}
				referencedSubstances[sid] = struct{}{}
				batch.ProductSubstances = append(batch.ProductSubstances, domain.PSMProductSubstance{
					ProductID:       p.ID,
					SubstanceID:     sid,
					InPercent:       parseFloat(ing.InPercent),
					InGrammPerLitre: parseFloat(ing.InGrammPerLitre),
				})
			}
		}
		for _, ind := range p.ProductInformation.Indications {
			if !indicationTargetsCulture(ind, targetCulture) {
				continue
			}
			for _, pest := range ind.Pests {
				pid, err := uuid.Parse(pest.PrimaryKey)
				if err != nil {
					continue
				}
				referencedPests[pid] = struct{}{}
				batch.Indications = append(batch.Indications, domain.PSMIndication{
					ProductID:         p.ID,
					PestID:            pid,
					DosageFrom:        parseFloat(ind.DosageFrom),
					DosageTo:          parseFloat(ind.DosageTo),
					DosageUnit:        ind.ExpenditureForm,
					WaitingPeriodDays: parseInt(ind.WaitingPeriod),
				})
			}
		}
	}

	// ── Pass 2: metadata for referenced IDs ─────────────────────────────
	if _, err := r.Seek(0, io.SeekStart); err != nil {
		return batch, err
	}
	dec = xml.NewDecoder(r)
	substancesByID := map[uuid.UUID]string{}
	pestsByID := map[uuid.UUID]string{}
	for {
		tok, err := dec.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return batch, err
		}
		se, ok := tok.(xml.StartElement)
		if !ok {
			continue
		}
		if se.Name.Local != "Detail" {
			continue
		}
		var d xmlDetail
		if err := dec.DecodeElement(&d, &se); err != nil {
			return batch, err
		}
		id, err := uuid.Parse(d.PrimaryKey)
		if err != nil {
			continue
		}
		name := pickLang(d.Descriptions, "de")
		if _, ok := referencedSubstances[id]; ok {
			if _, taken := substancesByID[id]; !taken {
				substancesByID[id] = name
			}
		}
		if _, ok := referencedPests[id]; ok {
			if _, taken := pestsByID[id]; !taken {
				pestsByID[id] = name
			}
		}
	}
	for id, name := range substancesByID {
		batch.Substances = append(batch.Substances, domain.PSMSubstance{ID: id, NameDE: name})
	}
	for id, name := range pestsByID {
		batch.Pests = append(batch.Pests, domain.PSMPest{ID: id, NameDE: name})
	}
	return batch, nil
}

func productTargetsCulture(p xmlProduct, target uuid.UUID) bool {
	for _, ind := range p.ProductInformation.Indications {
		if indicationTargetsCulture(ind, target) {
			return true
		}
	}
	return false
}

func indicationTargetsCulture(ind xmlIndication, target uuid.UUID) bool {
	for _, c := range ind.Cultures {
		if id, err := uuid.Parse(c.PrimaryKey); err == nil && id == target {
			return true
		}
	}
	return false
}

func pickLang(descs []xmlDescription, lang string) string {
	for _, d := range descs {
		if d.Language == lang {
			return d.Value
		}
	}
	if len(descs) > 0 {
		return descs[0].Value
	}
	return ""
}

func parseFloat(s string) *float64 {
	if s == "" {
		return nil
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return nil
	}
	return &f
}

func parseInt(s string) *int {
	if s == "" {
		return nil
	}
	i, err := strconv.Atoi(s)
	if err != nil {
		return nil
	}
	return &i
}

// parseDate parses BLV date attributes. The BLV XML uses YYYY-MM-DD; some
// fields are empty when unset. Returns nil for empty or unparseable input.
func parseDate(s string) *time.Time {
	if s == "" {
		return nil
	}
	for _, layout := range []string{"2006-01-02", "2006-01-02T15:04:05", time.RFC3339} {
		if t, err := time.Parse(layout, s); err == nil {
			return &t
		}
	}
	return nil
}

// ── XML stubs ─────────────────────────────────────────────────────────

type xmlProduct struct {
	ID                 string                `xml:"id,attr"`
	WNbr               string                `xml:"wNbr,attr"`
	Name               string                `xml:"name,attr"`
	ExhaustionDeadline string                `xml:"exhaustionDeadline,attr"`
	SoldoutDeadline    string                `xml:"soldoutDeadline,attr"`
	ProductInformation xmlProductInformation `xml:"ProductInformation"`
}

type xmlProductInformation struct {
	Ingredients []xmlIngredient `xml:"Ingredient"`
	Indications []xmlIndication `xml:"Indication"`
}

type xmlIngredient struct {
	InPercent       string     `xml:"inPercent,attr"`
	InGrammPerLitre string     `xml:"inGrammPerLitre,attr"`
	Substances      []xmlIDRef `xml:"Substance"`
}

type xmlIndication struct {
	DosageFrom      string     `xml:"dosageFrom,attr"`
	DosageTo        string     `xml:"dosageTo,attr"`
	WaitingPeriod   string     `xml:"waitingPeriod,attr"`
	ExpenditureForm string     `xml:"expenditureForm,attr"`
	Cultures        []xmlIDRef `xml:"Culture"`
	Pests           []xmlIDRef `xml:"Pest"`
}

type xmlIDRef struct {
	PrimaryKey string `xml:"primaryKey,attr"`
}

type xmlDetail struct {
	PrimaryKey   string           `xml:"primaryKey,attr"`
	Descriptions []xmlDescription `xml:"Description"`
}

type xmlDescription struct {
	Value    string `xml:"value,attr"`
	Language string `xml:"language,attr"`
}
