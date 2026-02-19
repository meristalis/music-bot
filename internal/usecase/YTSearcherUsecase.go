package usecase

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"music-go-bot/internal/domain"

	"github.com/lrstanley/go-ytdlp"
)

type SearchQueueClient interface {
	// После поиска нам нужно пнуть загрузчик
	EnqueueDownload(ctx context.Context, deezerID int64, ytID string) error
}
type YTSearcherUsecase struct {
	repo  domain.TrackRepository
	queue SearchQueueClient
}

func NewSearchUsecaseYT(repo domain.TrackRepository, queue SearchQueueClient) *YTSearcherUsecase {
	return &YTSearcherUsecase{
		repo:  repo,
		queue: queue,
	}
}

// ExecuteSearch — это метод, который будет вызывать воркер из очереди
func (u *YTSearcherUsecase) ExecuteSearch(ctx context.Context, deezerID int64) error {
	slog.Info("Запуск поиска на YouTube", "deezer_id", deezerID)

	// 1. Получаем данные трека из базы, чтобы знать что искать
	track, err := u.repo.GetByDeezerID(ctx, deezerID)
	if err != nil {
		return fmt.Errorf("track not found in db: %w", err)
	}

	// 2. Выполняем поиск
	ytID, err := u.findIDOnYoutube(ctx, track.Artist, track.Title, float64(track.Duration))
	if err != nil {
		// Если не нашли — помечаем ошибку в базе
		track.Status = domain.StatusError
		_ = u.repo.Save(ctx, track)
		return fmt.Errorf("youtube search failed: %w", err)
	}

	// 3. Обновляем track в базе: сохраняем найденный YoutubeID
	track.YoutubeID = ytID
	if err := u.repo.Save(ctx, track); err != nil {
		return fmt.Errorf("failed to update track with ytID: %w", err)
	}

	// 4. ПИНАЕМ ОЧЕРЕДЬ НА СКАЧИВАНИЕ
	slog.Info("YouTube ID найден, ставим задачу на Download", "yt_id", ytID)
	return u.queue.EnqueueDownload(ctx, deezerID, ytID)
}

// Внутренний метод самого поиска (твоя логика с ytdlp)
func (u *YTSearcherUsecase) findIDOnYoutube(ctx context.Context, artist, title string, targetDuration float64) (string, error) {
	query := fmt.Sprintf("%s - %s", artist, title)
	searchQuery := fmt.Sprintf("ytsearch5:%s", query)

	result, err := ytdlp.New().
		DumpSingleJSON().
		FlatPlaylist().
		Run(ctx, searchQuery)

	if err != nil {
		return "", err
	}

	var response struct {
		Entries []struct {
			ID       string  `json:"id"`
			Duration float64 `json:"duration"`
			Title    string  `json:"title"`
		} `json:"entries"`
	}

	if err := json.Unmarshal([]byte(result.Stdout), &response); err != nil {
		return "", err
	}

	if len(response.Entries) == 0 {
		return "", fmt.Errorf("nothing found")
	}

	var bestMatchID string
	minDiff := -1.0

	for _, entry := range response.Entries {
		// Пропускаем слишком длинные видео в любом случае
		if entry.Duration > 1200 {
			continue
		}

		// Вычисляем абсолютную разницу в секундах
		// Используем math.Abs для поиска ближайшего значения
		diff := math.Abs(entry.Duration - targetDuration)

		if minDiff == -1.0 || diff < minDiff {
			minDiff = diff
			bestMatchID = entry.ID
		}
	}

	if bestMatchID == "" {
		return "", fmt.Errorf("no suitable track found within duration limits")
	}

	return bestMatchID, nil
}
