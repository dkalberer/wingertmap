package psm

import (
	"context"
	"log"
	"sync"
	"time"
)

// Scheduler runs a background goroutine that triggers Sync at a fixed interval.
// It also performs one immediate sync at Start so the very first tick doesn't
// have to wait for the full interval.
type Scheduler struct {
	svc      *SyncService
	interval time.Duration
	wg       sync.WaitGroup
}

func NewScheduler(svc *SyncService, interval time.Duration) *Scheduler {
	return &Scheduler{svc: svc, interval: interval}
}

// Start launches the background goroutine. Returns immediately. Cancelling
// the context stops the scheduler. Use Wait() to block until the goroutine
// has actually exited.
func (s *Scheduler) Start(ctx context.Context) {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		if err := s.svc.Sync(ctx); err != nil {
			log.Printf("psm scheduler initial sync: %v", err)
		}
		t := time.NewTicker(s.interval)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				if err := s.svc.Sync(ctx); err != nil {
					log.Printf("psm scheduler periodic sync: %v", err)
				}
			}
		}
	}()
}

// Wait blocks until the scheduler goroutine has exited (after the context
// passed to Start was cancelled).
func (s *Scheduler) Wait() { s.wg.Wait() }
