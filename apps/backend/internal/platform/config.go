package platform

import (
	"errors"
	"os"
)

type Config struct {
	DBHost     string
	DBPort     string
	DBName     string
	DBUser     string
	DBPassword string
	DBSSLMode  string
	DBSchema   string
	JWTSecret  string
	Port       string

	S3Endpoint  string
	S3Bucket    string
	S3AccessKey string
	S3SecretKey string
}

func LoadConfig() (*Config, error) {
	c := &Config{
		DBHost:     env("DB_HOST", "localhost"),
		DBPort:     env("DB_PORT", "5432"),
		DBName:     env("DB_NAME", "postgres"),
		DBUser:     env("DB_USER", "postgres"),
		DBPassword: os.Getenv("DB_PASSWORD"),
		DBSSLMode:  env("DB_SSLMODE", "disable"),
		DBSchema:   env("DB_SCHEMA", "wingert"),
		JWTSecret:  os.Getenv("JWT_SECRET"),
		Port:       env("PORT", "8080"),

		S3Endpoint:  env("S3_ENDPOINT", "http://localhost:9000"),
		S3Bucket:    env("S3_BUCKET", "wingert-photos"),
		S3AccessKey: env("S3_ACCESS_KEY", "wingert"),
		S3SecretKey: env("S3_SECRET_KEY", "local-dev-minio"),
	}
	if c.DBPassword == "" {
		return nil, errors.New("DB_PASSWORD is required")
	}
	if c.JWTSecret == "" {
		return nil, errors.New("JWT_SECRET is required")
	}
	return c, nil
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
