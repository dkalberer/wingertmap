package handler_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"wingert/backend/internal/handler"
	hmw "wingert/backend/internal/handler/middleware"
	"wingert/backend/internal/protection"
	"wingert/backend/internal/service"
	"wingert/backend/internal/store"
	"wingert/backend/internal/testutil"
)

func TestCreateTask_WithSpray(t *testing.T) {
	db, cleanup := testutil.NewPostgresContainer(t)
	defer cleanup()
	testutil.RunMigrations(t, db)

	// Seed user + vineyard + a PSM substance for FK
	userID := uuid.New()
	require.NoError(t, db.Exec(`
		INSERT INTO users (id, email, name, role, password_hash, created_at)
		VALUES (?, 'a@b', 'A', 'admin', 'x', NOW())`, userID).Error)
	vyID := uuid.New()
	require.NoError(t, db.Exec(`
		INSERT INTO vineyards (id, name, owner_id, created_at)
		VALUES (?, 'V', ?, NOW())`, vyID, userID).Error)
	sid := uuid.MustParse("683783d6-0b1f-43d4-bf12-209fd6e3c693")
	require.NoError(t, db.Exec(`
		INSERT INTO psm_substances (id, name_de, synced_at)
		VALUES (?, 'Folpet', NOW())`, sid).Error)

	taskStore := store.NewTaskStore(db)
	sprayStore := store.NewSprayStore(db)
	periodStore := store.NewProtectionPeriodStore(db)
	periodWriter := protection.NewPeriodWriter(periodStore)
	h := handler.NewTaskHandler(taskStore, sprayStore, periodWriter)

	authSvc := service.NewAuthService(db, jwtSecret)
	authH := handler.NewAuthHandler(authSvc)

	r := chi.NewRouter()
	r.Use(hmw.CORS)
	r.Post("/api/auth/login", authH.Login)
	r.Group(func(r chi.Router) {
		r.Use(hmw.NewJWT(jwtSecret))
		r.Post("/api/tasks", h.Create)
	})

	// login (use the seed account from migration 002)
	loginRR := httptest.NewRecorder()
	r.ServeHTTP(loginRR, testutil.JSONRequest(t, "POST", "/api/auth/login",
		map[string]string{"email": seedEmail, "password": seedPassword}))
	require.Equal(t, http.StatusOK, loginRR.Code)
	var loginResp map[string]any
	testutil.DecodeJSON(t, loginRR, &loginResp)
	token := loginResp["token"].(string)

	body := map[string]any{
		"title":      "Spritzung",
		"recordType": "aufgabe",
		"category":   "pflanzenschutz",
		"subtype":    "spritzung",
		"vineyardId": vyID.String(),
		"spray": map[string]any{
			"substanceIds": []string{sid.String()},
			"dosage":       0.125,
			"dosageUnit":   "%",
		},
	}
	req := testutil.JSONRequest(t, "POST", "/api/tasks", body)
	req.Header.Set("Authorization", "Bearer "+token)

	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	require.Equal(t, http.StatusCreated, rr.Code, rr.Body.String())

	var taskResp struct {
		ID      string  `json:"id"`
		Subtype *string `json:"subtype"`
	}
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &taskResp))
	require.NotNil(t, taskResp.Subtype)
	assert.Equal(t, "spritzung", *taskResp.Subtype)

	var n int64
	require.NoError(t, db.Raw(`SELECT COUNT(*) FROM spray_applications WHERE task_id = ?::uuid`, taskResp.ID).Scan(&n).Error)
	assert.EqualValues(t, 1, n)
}
