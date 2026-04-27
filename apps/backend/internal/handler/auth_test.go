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

func newTestRouter(t *testing.T) (*chi.Mux, func()) {
	t.Helper()
	db, cleanup := testutil.NewPostgresContainer(t)
	testutil.RunMigrations(t, db)

	authSvc := service.NewAuthService(db, jwtSecret)
	authH := handler.NewAuthHandler(authSvc)

	r := chi.NewRouter()
	r.Use(hmw.CORS)
	r.Post("/api/auth/register", authH.Register)
	r.Post("/api/auth/login", authH.Login)
	r.Group(func(r chi.Router) {
		r.Use(hmw.NewJWT(jwtSecret))
		r.Get("/api/auth/me", authH.Me)
	})
	return r, cleanup
}

func TestRegisterHandler(t *testing.T) {
	r, cleanup := newTestRouter(t)
	defer cleanup()

	req := testutil.JSONRequest(t, "POST", "/api/auth/register", map[string]string{
		"email": "alice@example.com", "name": "Alice", "password": "secret123",
	})
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusCreated, rr.Code)
	var resp map[string]any
	testutil.DecodeJSON(t, rr, &resp)
	assert.Equal(t, "alice@example.com", resp["email"])
}

func TestRegisterDuplicate(t *testing.T) {
	r, cleanup := newTestRouter(t)
	defer cleanup()

	body := map[string]string{"email": "bob@example.com", "name": "Bob", "password": "pw"}
	r.ServeHTTP(httptest.NewRecorder(), testutil.JSONRequest(t, "POST", "/api/auth/register", body))

	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, testutil.JSONRequest(t, "POST", "/api/auth/register", body))
	assert.Equal(t, http.StatusConflict, rr.Code)
}

func TestLoginHandler(t *testing.T) {
	r, cleanup := newTestRouter(t)
	defer cleanup()

	r.ServeHTTP(httptest.NewRecorder(), testutil.JSONRequest(t, "POST", "/api/auth/register",
		map[string]string{"email": "carol@example.com", "name": "Carol", "password": "pw123"},
	))

	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, testutil.JSONRequest(t, "POST", "/api/auth/login",
		map[string]string{"email": "carol@example.com", "password": "pw123"},
	))
	assert.Equal(t, http.StatusOK, rr.Code)
	var resp map[string]any
	testutil.DecodeJSON(t, rr, &resp)
	assert.NotEmpty(t, resp["token"])
}

func TestLoginWrongPassword(t *testing.T) {
	r, cleanup := newTestRouter(t)
	defer cleanup()

	r.ServeHTTP(httptest.NewRecorder(), testutil.JSONRequest(t, "POST", "/api/auth/register",
		map[string]string{"email": "dave@example.com", "name": "Dave", "password": "correct"},
	))

	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, testutil.JSONRequest(t, "POST", "/api/auth/login",
		map[string]string{"email": "dave@example.com", "password": "wrong"},
	))
	assert.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestMeHandler(t *testing.T) {
	r, cleanup := newTestRouter(t)
	defer cleanup()

	r.ServeHTTP(httptest.NewRecorder(), testutil.JSONRequest(t, "POST", "/api/auth/register",
		map[string]string{"email": "eve@example.com", "name": "Eve", "password": "pw"},
	))

	loginRR := httptest.NewRecorder()
	r.ServeHTTP(loginRR, testutil.JSONRequest(t, "POST", "/api/auth/login",
		map[string]string{"email": "eve@example.com", "password": "pw"},
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
	assert.Equal(t, "eve@example.com", me["email"])
}

func TestMeUnauthorized(t *testing.T) {
	r, cleanup := newTestRouter(t)
	defer cleanup()

	req := httptest.NewRequest("GET", "/api/auth/me", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusUnauthorized, rr.Code)
}
