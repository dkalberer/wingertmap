package psm_test

import (
	"archive/zip"
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"wingert/backend/internal/domain"
	"wingert/backend/internal/psm"
)

// fakeRepo implements domain.PSMRepository for the sync test.
type fakeRepo struct {
	mu    sync.Mutex
	batch *domain.PSMBatch
	meta  *domain.PSMSyncMeta
}

func (r *fakeRepo) UpsertBatch(b domain.PSMBatch) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.batch = &b
	return nil
}
func (r *fakeRepo) SetMeta(m domain.PSMSyncMeta) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.meta = &m
	return nil
}
func (r *fakeRepo) Meta() (*domain.PSMSyncMeta, error) { return r.meta, nil }
func (r *fakeRepo) SearchProducts(string, int) ([]domain.PSMProduct, error) {
	return nil, nil
}
func (r *fakeRepo) GetProduct(string) (*domain.PSMProduct, error) { return nil, nil }
func (r *fakeRepo) SearchSubstances(string, int) ([]domain.PSMSubstance, error) {
	return nil, nil
}
func (r *fakeRepo) GetPestsForSubstances([]uuid.UUID) ([]uuid.UUID, error) { return nil, nil }

func buildZip(t *testing.T) []byte {
	t.Helper()
	raw, err := os.ReadFile("testdata/sample.xml")
	require.NoError(t, err)
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	w, err := zw.Create("PublicationData.xml")
	require.NoError(t, err)
	_, err = io.Copy(w, bytes.NewReader(raw))
	require.NoError(t, err)
	require.NoError(t, zw.Close())
	return buf.Bytes()
}

const rebenForSync = "2314eb9f-7207-409f-a0d4-89b6a1177363"

func TestSync_DownloadsAndUpserts(t *testing.T) {
	zipBytes := buildZip(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/zip")
		_, _ = w.Write(zipBytes)
	}))
	defer server.Close()

	repo := &fakeRepo{}
	svc := psm.NewSyncService(repo, server.URL, rebenForSync)

	err := svc.Sync(context.Background())
	require.NoError(t, err)
	require.NotNil(t, repo.batch)
	require.Len(t, repo.batch.Products, 1)
	assert.Equal(t, "Aktuan", repo.batch.Products[0].Name)
	require.NotNil(t, repo.meta)
	assert.Equal(t, "ok", repo.meta.Status)
	assert.Equal(t, 1, repo.meta.ProductCount)
}

func TestSync_RecentSyncSkips(t *testing.T) {
	repo := &fakeRepo{meta: &domain.PSMSyncMeta{
		LastSyncAt: time.Now().Add(-1 * time.Hour),
		Status:     "ok",
	}}
	svc := psm.NewSyncService(repo, "http://invalid.example", rebenForSync)
	err := svc.Sync(context.Background())
	require.NoError(t, err) // skip is not an error
	// batch should remain nil — sync was skipped
	assert.Nil(t, repo.batch)
}

func TestSync_StaleSyncProceeds(t *testing.T) {
	zipBytes := buildZip(t)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/zip")
		_, _ = w.Write(zipBytes)
	}))
	defer server.Close()

	repo := &fakeRepo{meta: &domain.PSMSyncMeta{
		LastSyncAt: time.Now().Add(-30 * 24 * time.Hour),
		Status:     "ok",
	}}
	svc := psm.NewSyncService(repo, server.URL, rebenForSync)

	err := svc.Sync(context.Background())
	require.NoError(t, err)
	require.NotNil(t, repo.batch)
	assert.Equal(t, "ok", repo.meta.Status)
}

func TestSync_DownloadErrorRecorded(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "not found", http.StatusNotFound)
	}))
	defer server.Close()

	repo := &fakeRepo{}
	svc := psm.NewSyncService(repo, server.URL, rebenForSync)
	err := svc.Sync(context.Background())
	require.Error(t, err)
	require.NotNil(t, repo.meta)
	assert.Equal(t, "failed", repo.meta.Status)
	assert.Contains(t, repo.meta.ErrorMessage, "status 404")
}
