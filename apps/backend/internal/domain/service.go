package domain

import "github.com/google/uuid"

// AuthService defines authentication operations.
type AuthService interface {
	Login(email, password string) (token string, user *User, err error)
	GetByID(id uuid.UUID) (*User, error)
	ChangePassword(userID uuid.UUID, currentPassword, newPassword string) error
}
