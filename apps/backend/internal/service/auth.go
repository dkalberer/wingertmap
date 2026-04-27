package service

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"wingert/backend/internal/domain"
)

// Claims holds the JWT payload.
type Claims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

type userRow struct {
	ID           uuid.UUID `gorm:"column:id"`
	Email        string    `gorm:"column:email"`
	Name         string    `gorm:"column:name"`
	Role         string    `gorm:"column:role"`
	PasswordHash string    `gorm:"column:password_hash"`
}

func (userRow) TableName() string { return "users" }

type AuthService struct {
	db        *gorm.DB
	jwtSecret []byte
}

func NewAuthService(db *gorm.DB, jwtSecret string) *AuthService {
	return &AuthService{db: db, jwtSecret: []byte(jwtSecret)}
}

func (s *AuthService) Register(email, name, password string) (*domain.User, error) {
	var existing userRow
	if err := s.db.Where("email = ?", email).First(&existing).Error; err == nil {
		return nil, errors.New("user already exists")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	row := userRow{
		ID:           uuid.New(),
		Email:        email,
		Name:         name,
		PasswordHash: string(hash),
		Role:         "viewer",
	}
	if err := s.db.Create(&row).Error; err != nil {
		return nil, err
	}
	return rowToUser(row), nil
}

func (s *AuthService) Login(email, password string) (string, *domain.User, error) {
	var row userRow
	if err := s.db.Where("email = ?", email).First(&row).Error; err != nil {
		return "", nil, errors.New("invalid credentials")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(row.PasswordHash), []byte(password)); err != nil {
		return "", nil, errors.New("invalid credentials")
	}
	token, err := s.generateToken(row)
	if err != nil {
		return "", nil, err
	}
	return token, rowToUser(row), nil
}

func (s *AuthService) GetByID(id uuid.UUID) (*domain.User, error) {
	var row userRow
	if err := s.db.First(&row, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return rowToUser(row), nil
}

func (s *AuthService) ValidateToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return s.jwtSecret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

func (s *AuthService) generateToken(row userRow) (string, error) {
	claims := Claims{
		UserID: row.ID.String(),
		Email:  row.Email,
		Role:   row.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.jwtSecret)
}

func rowToUser(r userRow) *domain.User {
	return &domain.User{
		ID:    r.ID,
		Email: r.Email,
		Name:  r.Name,
		Role:  r.Role,
	}
}
