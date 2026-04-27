package handler_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"wingert/backend/internal/handler"
	hmw "wingert/backend/internal/handler/middleware"
	"wingert/backend/internal/service"
	"wingert/backend/internal/testutil"
)

const jwtSecret = "handler_test_secret_long_enough_32chars!"

// Seed credentials from migrations/002_seed.sql
const (
	seedEmail    = "admin@wingert.local"
	seedPassword = "admin123"
)

func newTestRouter(t *testing.T) (*chi.Mux, func()) {
	t.Helper()
	db, cleanup := testutil.NewPostgresContainer(t)
	testutil.RunMigrations(t, db)

	authSvc := service.NewAuthService(db, jwtSecret)
	authH := handler.NewAuthHandler(authSvc)

	r := chi.NewRouter()
	r.Use(hmw.CORS)
	r.Post("/api/auth/login", authH.Login)
	r.Group(func(r chi.Router) {
		r.Use(hmw.NewJWT(jwtSecret))
		r.Get("/api/auth/me", authH.Me)
		r.Post("/api/auth/change-password", authH.ChangePassword)
	})
	return r, cleanup
}

func TestLoginHandler(t *testing.T) {
	r, cleanup := newTestRouter(t)
	defer cleanup()

	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, testutil.JSONRequest(t, "POST", "/api/auth/login",
		map[string]string{"email": seedEmail, "password": seedPassword},
	))
	assert.Equal(t, http.StatusOK, rr.Code)
	var resp map[string]any
	testutil.DecodeJSON(t, rr, &resp)
	assert.NotEmpty(t, resp["token"])
}

func TestLoginWrongPassword(t *testing.T) {
	r, cleanup := newTestRouter(t)
	defer cleanup()

	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, testutil.JSONRequest(t, "POST", "/api/auth/login",
		map[string]string{"email": seedEmail, "password": "wrong"},
	))
	assert.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestMeHandler(t *testing.T) {
	r, cleanup := newTestRouter(t)
	defer cleanup()

	loginRR := httptest.NewRecorder()
	r.ServeHTTP(loginRR, testutil.JSONRequest(t, "POST", "/api/auth/login",
		map[string]string{"email": seedEmail, "password": seedPassword},
	))
	var loginResp map[string]any
	testutil.DecodeJSON(t, loginRR, &loginResp)
	token := loginResp["token"].(string)

	req := httptest.NewRequest("GET", "/api/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	meRR := httptest.NewRecorder()
	r.ServeHTTP(meRR, req)
	assert.Equal(t, http.StatusOK, meRR.Code)
	var me map[string]any
	testutil.DecodeJSON(t, meRR, &me)
	assert.Equal(t, seedEmail, me["email"])
}

func TestMeUnauthorized(t *testing.T) {
	r, cleanup := newTestRouter(t)
	defer cleanup()

	req := httptest.NewRequest("GET", "/api/auth/me", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusUnauthorized, rr.Code)
}
