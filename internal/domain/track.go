package domain

import (
	"context"
	"time"
)

const (
	StatusReady      = "ready"
	StatusProcessing = "processing"
	StatusError      = "error"
)

type PlaybackResult struct {
	Status   string
	PlayLink string
}
type Track struct {
	ID           int64     `json:"id"`
	DeezerID     int64     `json:"deezer_id,omitempty"` // Добавили DeezerID
	YoutubeID    string    `json:"youtube_id,omitempty"`
	FileID       string    `json:"file_id"`
	FileUniqueID string    `json:"file_unique_id"`
	Title        string    `json:"title"`
	Artist       string    `json:"artist"`
	CoverURL     string    `json:"cover_url"` // Переименовали для ясности
	Duration     int       `json:"duration"`
	CreatedAt    time.Time `json:"created_at"`
	Status       string    `json:"status,omitempty"`
}

// TrackRepository — контракт для работы с БД по новой схеме
type TrackRepository interface {
	// Сохраняет трек и создает связь с пользователем
	Save(ctx context.Context, track *Track) error
	AddToUser(ctx context.Context, userID int64, trackID int64) error
	// Получает библиотеку конкретного пользователя
	GetByUserID(ctx context.Context, userID int64) ([]Track, error)

	// Удаляет только связь пользователя с треком (сам трек остается в базе)
	DeleteFromUser(ctx context.Context, userID int64, trackID int64) error

	// Поиск для кэша
	//GetByYoutubeID(ctx context.Context, youtubeID string) (*Track, error)
	GetByDeezerID(ctx context.Context, deezerID int64) (*Track, error)
	GetByFileUniqueID(ctx context.Context, fileUniqueID string) (*Track, error)
	UpdateStatus(ctx context.Context, deezerID int64, status string) error
}
