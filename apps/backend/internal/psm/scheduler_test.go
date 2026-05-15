package psm_test

import (
	"archive/zip"
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"wingert/backend/internal/psm"
)

func TestScheduler_TicksAtInterval(t *testing.T) {
	raw, err := os.ReadFile("testdata/sample.xml")
	require.NoError(t, err)
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	w, _ := zw.Create("PublicationData.xml")
	_, _ = io.Copy(w, bytes.NewReader(raw))
	_ = zw.Close()
	zipBytes := buf.Bytes()

	var hits int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&hits, 1)
		w.Header().Set("Content-Type", "application/zip")
		_, _ = w.Write(zipBytes)
	}))
	defer server.Close()

	repo := &fakeRepo{}
	svc := psm.NewSyncService(repo, server.URL, rebenForSync)
	svc.SetMinSyncSpacing(1 * time.Millisecond)

	sched := psm.NewScheduler(svc, 30*time.Millisecond)
	ctx, cancel := context.WithCancel(context.Background())
	sched.Start(ctx)
	time.Sleep(120 * time.Millisecond)
	cancel()
	sched.Wait()

	got := atomic.LoadInt32(&hits)
	assert.GreaterOrEqual(t, got, int32(3), "expected at least 3 syncs, got %d", got)
}

func TestScheduler_StopsOnContextCancel(t *testing.T) {
	repo := &fakeRepo{}
	svc := psm.NewSyncService(repo, "http://invalid.example", rebenForSync)
	sched := psm.NewScheduler(svc, 10*time.Millisecond)
	ctx, cancel := context.WithCancel(context.Background())
	sched.Start(ctx)
	cancel()
	sched.Wait()
}
