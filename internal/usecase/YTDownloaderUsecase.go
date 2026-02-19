package usecase

import (
	"context"
	"fmt"
	"log/slog"
	"music-go-bot/internal/domain"
	"os"
	"path/filepath"

	"github.com/lrstanley/go-ytdlp"
)

// Интерфейс очереди, чтобы поставить задачу на Upload
type QueueClient interface {
	EnqueueUpload(ctx context.Context, trackID int64, filePath string) error
}

type YTDownloaderUsecase struct {
	repo  domain.TrackRepository
	queue QueueClient
}

func NewYTDownloaderUsecase(repo domain.TrackRepository, queue QueueClient) *YTDownloaderUsecase {
	return &YTDownloaderUsecase{
		repo:  repo,
		queue: queue,
	}
}

func (u *YTDownloaderUsecase) Download(ctx context.Context, deezerID int64, ytID string) error {
	slog.Info("Запуск скачивания с YouTube", "yt_id", ytID)

	// 1. Скачиваем
	filePath, err := u.downloadFile(ctx, ytID)
	if err != nil {
		track, _ := u.repo.GetByDeezerID(ctx, deezerID)
		if track != nil {
			track.Status = "error"
			u.repo.Save(ctx, track)
		}
		return fmt.Errorf("ytdlp.Run: %w", err)
	}

	// 2. Пинкаем очередь на загрузку
	slog.Info("Скачивание завершено, ставим задачу на Upload", "file", filePath)
	return u.queue.EnqueueUpload(ctx, deezerID, filePath)
}

func (u *YTDownloaderUsecase) downloadFile(ctx context.Context, ytID string) (string, error) {
	tmpDir := "bot/downloads"
	if err := os.MkdirAll(tmpDir, 0755); err != nil {
		return "", err
	}

	outputPath := filepath.Join(tmpDir, fmt.Sprintf("%s.mp3", ytID))
	dl := ytdlp.New().
		ExtractAudio().
		AudioFormat("mp3").
		AudioQuality("0").
		Output(outputPath).
		NoPlaylist()

	videoURL := fmt.Sprintf("https://www.youtube.com/watch?v=%s", ytID)
	if _, err := dl.Run(ctx, videoURL); err != nil {
		return "", err
	}

	return outputPath, nil
}
