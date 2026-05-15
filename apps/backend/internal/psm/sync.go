package psm

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"wingert/backend/internal/domain"
)

const (
	DefaultPSMZipURL      = "https://www.blv.admin.ch/dam/blv/de/dokumente/zulassung-pflanzenschutzmittel/pflanzenschutzmittelverzeichnis/daten-pflanzenschutzmittelverzeichnis.zip.download.zip/Daten%20Pflanzenschutzmittelverzeichnis.zip"
	DefaultMinSyncSpacing = 7 * 24 * time.Hour
)

type SyncService struct {
	repo           domain.PSMRepository
	url            string
	cultureID      string
	httpClient     *http.Client
	minSyncSpacing time.Duration
	mu             sync.Mutex
}

func NewSyncService(repo domain.PSMRepository, url, cultureID string) *SyncService {
	return &SyncService{
		repo:           repo,
		url:            url,
		cultureID:      cultureID,
		httpClient:     &http.Client{Timeout: 5 * time.Minute},
		minSyncSpacing: DefaultMinSyncSpacing,
	}
}

// SetMinSyncSpacing overrides the default skip-threshold (mostly for tests).
func (s *SyncService) SetMinSyncSpacing(d time.Duration) { s.minSyncSpacing = d }

// Sync downloads + parses + upserts. If a recent successful sync exists,
// it returns nil without doing work.
func (s *SyncService) Sync(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if meta, err := s.repo.Meta(); err == nil && meta != nil {
		if meta.Status == "ok" && time.Since(meta.LastSyncAt) < s.minSyncSpacing {
			return nil
		}
	}

	started := time.Now()
	_ = s.repo.SetMeta(domain.PSMSyncMeta{LastSyncAt: started, Status: "running"})

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.url, nil)
	if err != nil {
		return s.fail(err)
	}
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return s.fail(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return s.fail(fmt.Errorf("psm download: status %d", resp.StatusCode))
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return s.fail(err)
	}

	zr, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if err != nil {
		return s.fail(err)
	}
	var xmlFile *zip.File
	for _, f := range zr.File {
		if !strings.HasSuffix(f.Name, ".xml") {
			continue
		}
		// Prefer the un-dated name; some BLV ZIPs include both
		// PublicationData.xml and PublicationData_YYYY_MM_DD.xml.
		if f.Name == "PublicationData.xml" {
			xmlFile = f
			break
		}
		if xmlFile == nil {
			xmlFile = f
		}
	}
	if xmlFile == nil {
		return s.fail(fmt.Errorf("psm zip: no PublicationData.xml inside"))
	}

	rc, err := xmlFile.Open()
	if err != nil {
		return s.fail(err)
	}
	xmlBytes, err := io.ReadAll(rc)
	rc.Close()
	if err != nil {
		return s.fail(err)
	}

	batch, err := ParseXML(bytes.NewReader(xmlBytes), s.cultureID)
	if err != nil {
		return s.fail(err)
	}
	batch.SyncedAt = started

	if err := s.repo.UpsertBatch(batch); err != nil {
		return s.fail(err)
	}

	return s.repo.SetMeta(domain.PSMSyncMeta{
		LastSyncAt:   time.Now(),
		ProductCount: len(batch.Products),
		Status:       "ok",
	})
}

func (s *SyncService) fail(err error) error {
	_ = s.repo.SetMeta(domain.PSMSyncMeta{
		LastSyncAt:   time.Now(),
		Status:       "failed",
		ErrorMessage: err.Error(),
	})
	return err
}
