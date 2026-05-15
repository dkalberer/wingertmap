package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"wingert/backend/internal/service"
)

type contextKey string

const claimsKey contextKey = "claims"

func NewJWT(jwtSecret string) func(http.Handler) http.Handler {
	authSvc := service.NewAuthService(nil, jwtSecret)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				writeUnauthorized(w, "missing token")
				return
			}
			claims, err := authSvc.ValidateToken(strings.TrimPrefix(header, "Bearer "))
			if err != nil {
				writeUnauthorized(w, "invalid token")
				return
			}
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), claimsKey, claims)))
		})
	}
}

// ClaimsFromContext extracts JWT claims from the request context.
func ClaimsFromContext(ctx context.Context) *service.Claims {
	v, _ := ctx.Value(claimsKey).(*service.Claims)
	return v
}


// CORS is a no-op middleware kept for compatibility with the existing test suite.
// The real CORS handler is configured at the router level via go-chi/cors.
var CORS = func(next http.Handler) http.Handler { return next }

func writeUnauthorized(w http.ResponseWriter, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
