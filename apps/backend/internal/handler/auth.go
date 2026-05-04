package handler

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"wingert/backend/internal/domain"
	"wingert/backend/internal/handler/middleware"
)

type AuthHandler struct{ svc domain.AuthService }

func NewAuthHandler(svc domain.AuthService) *AuthHandler { return &AuthHandler{svc: svc} }


func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	token, user, err := h.svc.Login(req.Email, req.Password)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "user": user})
}


func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	var req struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if req.CurrentPassword == "" || req.NewPassword == "" {
		writeError(w, http.StatusBadRequest, "currentPassword and newPassword required")
		return
	}
	id, err := uuid.Parse(claims.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "invalid user id in token")
		return
	}
	if err := h.svc.ChangePassword(id, req.CurrentPassword, req.NewPassword); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Passwort erfolgreich geändert."})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	id, err := uuid.Parse(claims.UserID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "invalid user id in token")
		return
	}
	user, err := h.svc.GetByID(id)
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	writeJSON(w, http.StatusOK, user)
}
