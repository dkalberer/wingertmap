package service_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"wingert/backend/internal/service"
	"wingert/backend/internal/testutil"
)

const testJWTSecret = "test_jwt_secret_long_enough_32chars!"

// Seed credentials from migrations/002_seed.sql
const (
	seedEmail    = "admin@wingert.local"
	seedPassword = "admin123"
)

func newAuthService(t *testing.T) (*service.AuthService, func()) {
	t.Helper()
	db, cleanup := testutil.NewPostgresContainer(t)
	testutil.RunMigrations(t, db)
	return service.NewAuthService(db, testJWTSecret), cleanup
}

func TestLogin(t *testing.T) {
	svc, cleanup := newAuthService(t)
	defer cleanup()

	token, user, err := svc.Login(seedEmail, seedPassword)
	require.NoError(t, err)
	assert.NotEmpty(t, token)
	assert.Equal(t, seedEmail, user.Email)
}

func TestLoginWrongPassword(t *testing.T) {
	svc, cleanup := newAuthService(t)
	defer cleanup()

	_, _, err := svc.Login(seedEmail, "wrong")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid credentials")
}

func TestLoginUnknownEmail(t *testing.T) {
	svc, cleanup := newAuthService(t)
	defer cleanup()

	_, _, err := svc.Login("nobody@example.com", "pw")
	require.Error(t, err)
}

func TestValidateToken(t *testing.T) {
	svc, cleanup := newAuthService(t)
	defer cleanup()

	token, _, err := svc.Login(seedEmail, seedPassword)
	require.NoError(t, err)

	claims, err := svc.ValidateToken(token)
	require.NoError(t, err)
	assert.Equal(t, seedEmail, claims.Email)
}

func TestValidateTokenInvalid(t *testing.T) {
	svc, cleanup := newAuthService(t)
	defer cleanup()

	_, err := svc.ValidateToken("not.a.valid.token")
	require.Error(t, err)
}
