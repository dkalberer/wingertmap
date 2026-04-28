package platform_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"wingert/backend/internal/platform"
)

func TestConfigDefaults(t *testing.T) {
	t.Setenv("DB_PASSWORD", "secret")
	t.Setenv("JWT_SECRET", "a_very_long_jwt_secret_at_least_32_chars")
	t.Setenv("DB_HOST", "")
	t.Setenv("DB_PORT", "")
	t.Setenv("PORT", "")

	cfg, err := platform.LoadConfig()
	require.NoError(t, err)
	assert.Equal(t, "localhost", cfg.DBHost)
	assert.Equal(t, "5432", cfg.DBPort)
	assert.Equal(t, "postgres", cfg.DBName)
	assert.Equal(t, "8080", cfg.Port)
}

func TestConfigEnvOverride(t *testing.T) {
	t.Setenv("DB_HOST", "myhost")
	t.Setenv("DB_PORT", "5433")
	t.Setenv("DB_PASSWORD", "pw")
	t.Setenv("JWT_SECRET", "secret32charslong_____________________")
	t.Setenv("PORT", "9090")

	cfg, err := platform.LoadConfig()
	require.NoError(t, err)
	assert.Equal(t, "myhost", cfg.DBHost)
	assert.Equal(t, "5433", cfg.DBPort)
	assert.Equal(t, "9090", cfg.Port)
}

func TestConfigMissingDBPassword(t *testing.T) {
	t.Setenv("DB_PASSWORD", "")
	t.Setenv("JWT_SECRET", "secret")

	_, err := platform.LoadConfig()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "DB_PASSWORD")
}

func TestConfigMissingJWTSecret(t *testing.T) {
	t.Setenv("DB_PASSWORD", "pw")
	t.Setenv("JWT_SECRET", "")

	_, err := platform.LoadConfig()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "JWT_SECRET")
}
