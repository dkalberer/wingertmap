package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"wingert/backend/internal/handler/middleware"
	"wingert/backend/internal/service"
)

const secret = "test_secret_long_enough_for_testing_32chars!"

func TestJWTNoHeader(t *testing.T) {
	mw := middleware.NewJWT(secret)
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestJWTInvalidToken(t *testing.T) {
	mw := middleware.NewJWT(secret)
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer not.a.valid.token")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestJWTValidToken(t *testing.T) {
	token, err := service.GenerateTokenForTest(secret, "user-id-123", "test@example.com", "viewer")
	if err != nil {
		t.Fatalf("generate token: %v", err)
	}

	mw := middleware.NewJWT(secret)
	var claimsEmail string
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := middleware.ClaimsFromContext(r.Context())
		if claims != nil {
			claimsEmail = claims.Email
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	assert.Equal(t, http.StatusOK, rr.Code)
	assert.Equal(t, "test@example.com", claimsEmail)
}
