package testutil

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
	gormpg "gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// NewPostgresContainer starts a PostGIS container and returns a GORM DB and a cleanup func.
func NewPostgresContainer(t *testing.T) (*gorm.DB, func()) {
	t.Helper()
	ctx := context.Background()

	ctr, err := postgres.Run(ctx,
		"postgis/postgis:16-3.4",
		postgres.WithDatabase("wingert_test"),
		postgres.WithUsername("wingert"),
		postgres.WithPassword("wingert_test"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(60*time.Second),
		),
	)
	if err != nil {
		t.Fatalf("start postgres container: %v", err)
	}

	dsn, err := ctr.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("get connection string: %v", err)
	}

	db, err := gorm.Open(gormpg.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open gorm: %v", err)
	}

	return db, func() {
		if err := ctr.Terminate(ctx); err != nil {
			t.Logf("terminate container: %v", err)
		}
	}
}

// MigrationsDir returns the absolute path to apps/backend/migrations.
func MigrationsDir() string {
	_, file, _, _ := runtime.Caller(0)
	// file = .../apps/backend/internal/testutil/db.go
	return filepath.Join(filepath.Dir(file), "..", "..", "migrations")
}

// RunMigrations executes all SQL files in the migrations directory in order.
func RunMigrations(t *testing.T, db *gorm.DB) {
	t.Helper()
	if err := db.Exec("CREATE SCHEMA IF NOT EXISTS public").Error; err != nil {
		t.Fatalf("create schema: %v", err)
	}
	dir := MigrationsDir()
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("read migrations dir %s: %v", dir, err)
	}
	for _, e := range entries {
		if filepath.Ext(e.Name()) != ".sql" {
			continue
		}
		sql, err := os.ReadFile(filepath.Join(dir, e.Name()))
		if err != nil {
			t.Fatalf("read migration %s: %v", e.Name(), err)
		}
		if err := db.Exec(fmt.Sprintf("%s", sql)).Error; err != nil {
			t.Fatalf("exec migration %s: %v", e.Name(), err)
		}
	}
}
