package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"wingert/backend/internal/agrometeo"
	"wingert/backend/internal/handler"
	hmw "wingert/backend/internal/handler/middleware"
	"wingert/backend/internal/platform"
	"wingert/backend/internal/service"
	"wingert/backend/internal/store"
)

func main() {
	cfg, err := platform.LoadConfig()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	db, err := platform.NewDB(cfg)
	if err != nil {
		log.Fatalf("database: %v", err)
	}

	_, file, _, _ := runtime.Caller(0)
	migrationsDir := filepath.Join(filepath.Dir(file), "migrations")
	if err := platform.RunMigrations(db, migrationsDir, cfg.DBSchema); err != nil {
		log.Fatalf("migrations: %v", err)
	}

	authSvc := service.NewAuthService(db, cfg.JWTSecret)

	minioClient, err := platform.NewMinioClient(cfg)
	if err != nil {
		log.Fatalf("minio: %v", err)
	}

	vineyardStore := store.NewVineyardStore(db)
	rowStore := store.NewRowStore(db)
	vineStore := store.NewVineStore(db)
	taskStore := store.NewTaskStore(db)
	varietyStore := store.NewGrapeVarietyStore(db)
	harvestStore := store.NewHarvestStore(db)
	pruningStore := store.NewPruningStore(db)
	journalStore := store.NewJournalStore(db)
	employeeStore := store.NewEmployeeStore(db)
	workTypeStore := store.NewWorkTypeStore(db)
	timeEntryStore := store.NewTimeEntryStore(db)

	agroClient := agrometeo.NewClient()
	agroCache := agrometeo.NewCache()

	authH := handler.NewAuthHandler(authSvc)
	vineyardH := handler.NewVineyardHandler(vineyardStore)
	rowH := handler.NewRowHandler(rowStore)
	vineH := handler.NewVineHandler(vineStore)
	taskH := handler.NewTaskHandler(taskStore)
	varietyH := handler.NewGrapeVarietyHandler(varietyStore)
	harvestH := handler.NewHarvestHandler(harvestStore)
	pruningH := handler.NewPruningHandler(pruningStore)
	journalH := handler.NewJournalHandler(journalStore)
	employeeH := handler.NewEmployeeHandler(employeeStore)
	workTypeH := handler.NewWorkTypeHandler(workTypeStore)
	timeEntryH := handler.NewTimeEntryHandler(timeEntryStore)
	weatherH := handler.NewWeatherHandler(vineyardStore, taskStore, agroClient, agroCache)
	photoH := handler.NewPhotoHandler(db, minioClient, cfg.S3Bucket)

	jwtMW := hmw.NewJWT(cfg.JWTSecret)

	r := chi.NewRouter()
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(hmw.CORS)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	r.Post("/api/auth/login", authH.Login)

	r.Group(func(r chi.Router) {
		r.Use(jwtMW)
		r.Get("/api/auth/me", authH.Me)
		r.Post("/api/auth/change-password", authH.ChangePassword)

		r.Get("/api/vineyards", vineyardH.List)
		r.Post("/api/vineyards", vineyardH.Create)
		r.Get("/api/vineyards/{id}", vineyardH.Get)
		r.Put("/api/vineyards/{id}", vineyardH.Update)
		r.Delete("/api/vineyards/{id}", vineyardH.Delete)

		r.Get("/api/vineyards/{vineyardID}/rows", rowH.List)
		r.Post("/api/vineyards/{vineyardID}/rows", rowH.Create)
		r.Post("/api/vineyards/{vineyardID}/rows/confirm-all", rowH.ConfirmAll)
		r.Patch("/api/rows/{id}/status", rowH.UpdateStatus)
		r.Patch("/api/rows/{id}/line", rowH.UpdateLine)
		r.Delete("/api/rows/{id}", rowH.Delete)

		r.Get("/api/rows/{rowID}/vines", vineH.List)
		r.Post("/api/rows/{rowID}/vines", vineH.Create)
		r.Get("/api/vines/nearby", vineH.Nearby)

		r.Get("/api/vines/{vineID}/tasks", taskH.List)
		r.Get("/api/tasks", taskH.All)
		r.Post("/api/tasks", taskH.Create)
		r.Patch("/api/tasks/{id}/status", taskH.UpdateStatus)
		r.Delete("/api/tasks/{id}", taskH.Delete)

		r.Get("/api/varieties", varietyH.List)
		r.Post("/api/varieties", varietyH.Create)
		r.Delete("/api/varieties/{id}", varietyH.Delete)

		r.Get("/api/vineyards/{vineyardID}/harvests", harvestH.List)
		r.Post("/api/vineyards/{vineyardID}/harvests", harvestH.Create)
		r.Put("/api/harvests/{id}", harvestH.Update)
		r.Delete("/api/harvests/{id}", harvestH.Delete)

		r.Get("/api/vineyards/{vineyardID}/pruning", pruningH.List)
		r.Post("/api/vineyards/{vineyardID}/pruning", pruningH.Create)
		r.Put("/api/pruning/{id}", pruningH.Update)
		r.Delete("/api/pruning/{id}", pruningH.Delete)

		r.Get("/api/vineyards/{id}/weather", weatherH.Weather)
		r.Get("/api/vineyards/{id}/plant-protection-status", weatherH.PlantProtectionStatus)

		r.Get("/api/vineyards/{vineyardID}/journals", journalH.List)
		r.Get("/api/vineyards/{vineyardID}/journals/{year}", journalH.GetByYear)
		r.Put("/api/vineyards/{vineyardID}/journals/{year}", journalH.Upsert)

		r.Get("/api/employees", employeeH.List)
		r.Post("/api/employees", employeeH.Create)
		r.Delete("/api/employees/{id}", employeeH.Delete)

		r.Get("/api/work-types", workTypeH.List)
		r.Post("/api/work-types", workTypeH.Create)
		r.Delete("/api/work-types/{id}", workTypeH.Delete)

		r.Get("/api/time-entries", timeEntryH.List)
		r.Post("/api/time-entries", timeEntryH.Create)
		r.Delete("/api/time-entries/{id}", timeEntryH.Delete)
		r.Get("/api/time-entries/stats", timeEntryH.Stats)
		r.Get("/api/time-entries/export", timeEntryH.Export)
		r.Post("/api/time-entries/import", timeEntryH.Import)

		r.Get("/api/tasks/{taskID}/photos", photoH.List)
		r.Post("/api/tasks/{taskID}/photos", photoH.Upload)
	})

	// Photo content is served without JWT — the URL is unguessable (UUID-based)
	r.Get("/api/tasks/{taskID}/photos/{photoID}/content", photoH.Content)

	srv := &http.Server{Addr: ":" + cfg.Port, Handler: r}
	go func() {
		log.Printf("listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}
