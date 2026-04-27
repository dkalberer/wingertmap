package domain

import "github.com/google/uuid"

// AuthService defines authentication operations.
type AuthService interface {
	Register(email, name, password string) (*User, error)
	Login(email, password string) (token string, user *User, err error)
	GetByID(id uuid.UUID) (*User, error)
}
