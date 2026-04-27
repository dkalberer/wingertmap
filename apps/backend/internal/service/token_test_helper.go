package service

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// GenerateTokenForTest creates a signed JWT for use in tests without needing a DB.
func GenerateTokenForTest(secret, userID, email, role string) (string, error) {
	claims := Claims{
		UserID: userID,
		Email:  email,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
}
