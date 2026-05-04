package handler

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"gorm.io/gorm"
)

type photoRow struct {
	ID        uuid.UUID `gorm:"column:id"`
	TaskID    uuid.UUID `gorm:"column:task_id"`
	ObjectKey string    `gorm:"column:object_key"`
	CreatedAt time.Time `gorm:"column:created_at"`
}

func (photoRow) TableName() string { return "task_photos" }

type PhotoHandler struct {
	db     *gorm.DB
	minio  *minio.Client
	bucket string
}

func NewPhotoHandler(db *gorm.DB, mc *minio.Client, bucket string) *PhotoHandler {
	return &PhotoHandler{db: db, minio: mc, bucket: bucket}
}

func (h *PhotoHandler) Upload(w http.ResponseWriter, r *http.Request) {
	taskID, err := uuid.Parse(chi.URLParam(r, "taskID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid task id")
		return
	}

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "file too large")
		return
	}
	file, header, err := r.FormFile("photo")
	if err != nil {
		writeError(w, http.StatusBadRequest, "photo field missing")
		return
	}
	defer file.Close()

	objectKey := fmt.Sprintf("tasks/%s/%s-%s", taskID, uuid.New(), header.Filename)
	_, err = h.minio.PutObject(
		context.Background(),
		h.bucket,
		objectKey,
		file,
		header.Size,
		minio.PutObjectOptions{ContentType: header.Header.Get("Content-Type")},
	)
	if err != nil {
		writeInternalError(w, err)
		return
	}

	row := photoRow{ID: uuid.New(), TaskID: taskID, ObjectKey: objectKey}
	if err := h.db.Create(&row).Error; err != nil {
		writeInternalError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{
		"id":        row.ID.String(),
		"objectKey": objectKey,
		"url":       fmt.Sprintf("/api/tasks/%s/photos/%s/content", taskID, row.ID),
	})
}

func (h *PhotoHandler) List(w http.ResponseWriter, r *http.Request) {
	taskID, err := uuid.Parse(chi.URLParam(r, "taskID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid task id")
		return
	}

	var rows []photoRow
	if err := h.db.Where("task_id = ?", taskID).Order("created_at asc").Find(&rows).Error; err != nil {
		writeInternalError(w, err)
		return
	}

	type photoResp struct {
		ID        string `json:"id"`
		ObjectKey string `json:"objectKey"`
		URL       string `json:"url"`
		CreatedAt string `json:"createdAt"`
	}
	result := make([]photoResp, len(rows))
	for i, row := range rows {
		result[i] = photoResp{
			ID:        row.ID.String(),
			ObjectKey: row.ObjectKey,
			URL:       fmt.Sprintf("/api/tasks/%s/photos/%s/content", taskID, row.ID),
			CreatedAt: row.CreatedAt.Format(time.RFC3339),
		}
	}
	writeJSON(w, http.StatusOK, result)
}

// Content proxies the image bytes from Minio to the browser.
func (h *PhotoHandler) Content(w http.ResponseWriter, r *http.Request) {
	photoID, err := uuid.Parse(chi.URLParam(r, "photoID"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid photo id")
		return
	}

	var row photoRow
	if err := h.db.First(&row, "id = ?", photoID).Error; err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	obj, err := h.minio.GetObject(context.Background(), h.bucket, row.ObjectKey, minio.GetObjectOptions{})
	if err != nil {
		writeInternalError(w, err)
		return
	}
	defer obj.Close()

	info, err := obj.Stat()
	if err != nil {
		writeInternalError(w, err)
		return
	}

	w.Header().Set("Content-Type", info.ContentType)
	w.Header().Set("Cache-Control", "private, max-age=86400")
	io.Copy(w, obj)
}
