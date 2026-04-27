package service_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"wingert/backend/internal/service"
	"wingert/backend/internal/testutil"
)

const testJWTSecret = "test_jwt_secret_long_enough_32chars!"

func newAuthService(t *testing.T) (*service.AuthService, func()) {
	t.Helper()
	db, cleanup := testutil.NewPostgresContainer(t)
	testutil.RunMigrations(t, db)
	return service.NewAuthService(db, testJWTSecret), cleanup
}

func TestRegister(t *testing.T) {
	svc, cleanup := newAuthService(t)
	defer cleanup()

	user, err := svc.Register("alice@example.com", "Alice", "password123")
	require.NoError(t, err)
	assert.NotEmpty(t, user.ID)
	assert.Equal(t, "alice@example.com", user.Email)
	assert.Equal(t, "viewer", user.Role)
	assert.Empty(t, user.PasswordHash, "password hash must not be returned")
}

func TestRegisterDuplicateEmail(t *testing.T) {
	svc, cleanup := newAuthService(t)
	defer cleanup()

	_, err := svc.Register("bob@example.com", "Bob", "pw")
	require.NoError(t, err)

	_, err = svc.Register("bob@example.com", "Bob2", "pw2")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "already exists")
}

func TestLogin(t *testing.T) {
	svc, cleanup := newAuthService(t)
	defer cleanup()

	_, err := svc.Register("carol@example.com", "Carol", "secret")
	require.NoError(t, err)

	token, user, err := svc.Login("carol@example.com", "secret")
	require.NoError(t, err)
	assert.NotEmpty(t, token)
	assert.Equal(t, "carol@example.com", user.Email)
}

func TestLoginWrongPassword(t *testing.T) {
	svc, cleanup := newAuthService(t)
	defer cleanup()

	_, err := svc.Register("dave@example.com", "Dave", "correct")
	require.NoError(t, err)

	_, _, err = svc.Login("dave@example.com", "wrong")
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

	_, err := svc.Register("eve@example.com", "Eve", "pw")
	require.NoError(t, err)

	token, _, err := svc.Login("eve@example.com", "pw")
	require.NoError(t, err)

	claims, err := svc.ValidateToken(token)
	require.NoError(t, err)
	assert.Equal(t, "eve@example.com", claims.Email)
}

func TestValidateTokenInvalid(t *testing.T) {
	svc, cleanup := newAuthService(t)
	defer cleanup()

	_, err := svc.ValidateToken("not.a.valid.token")
	require.Error(t, err)
}
