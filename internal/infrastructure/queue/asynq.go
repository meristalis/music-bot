package queue

import (
	"context"
	"fmt"
	"music-go-bot/internal/tasks"

	"github.com/hibiken/asynq"
)

// AsynqQueue — обертка над клиентом asynq
type AsynqQueue struct {
	client    *asynq.Client
	inspector *asynq.Inspector
}

// TrackQueue — интерфейс, который мы прокидываем в UseCase.
// Теперь тут два метода для нашей цепочки.
type TrackQueue interface {
	EnqueueDownload(ctx context.Context, trackID int64, ytID string) error
	EnqueueUpload(ctx context.Context, trackID int64, filePath string) error
	GetEstimatedWaitTime() (int, error)
	EnqueueSearch(ctx context.Context, DeezerID int64) error
}

func NewAsynqQueue(redisAddr string) *AsynqQueue {
	redisOpt := asynq.RedisClientOpt{Addr: redisAddr}

	// Инициализируем оба компонента
	client := asynq.NewClient(redisOpt)
	inspector := asynq.NewInspector(redisOpt)

	return &AsynqQueue{
		client:    client,
		inspector: inspector,
	}
}

// 1. Задача на скачивание (вызывается из API/TrackUsecase)
func (q *AsynqQueue) EnqueueDownload(ctx context.Context, trackID int64, ytID string) error {
	t, err := tasks.NewDownloadYoutubeTask(trackID, ytID)
	if err != nil {
		return fmt.Errorf("failed to create download task: %w", err)
	}

	_, err = q.client.Enqueue(t, asynq.MaxRetry(2)) // YouTube может капризничать, дадим 3 попытки
	return err
}

// 2. Задача на загрузку (вызывается из YTDownloaderUsecase)
func (q *AsynqQueue) EnqueueUpload(ctx context.Context, trackID int64, filePath string) error {
	// ВАЖНО: Тебе нужно создать функцию NewTelegramUploadTask в пакете tasks
	t, err := tasks.NewTelegramUploadTask(trackID, filePath)
	if err != nil {
		return fmt.Errorf("failed to create upload task: %w", err)
	}

	// Для Telegram загрузки ставим MaxRetry побольше,
	// так как файл уже скачан, и мы просто ждем окна в лимитах API
	_, err = q.client.Enqueue(t, asynq.MaxRetry(5))
	return err
}

func (q *AsynqQueue) GetEstimatedWaitTime() (int, error) {
	info, err := q.inspector.GetQueueInfo("default")
	if err != nil {
		return 0, err
	}

	totalSubTasks := info.Pending + info.Active + 1

	return totalSubTasks * 40, nil
}
func (q *AsynqQueue) Close() error {
	var errs []error
	if q.inspector != nil {
		if err := q.inspector.Close(); err != nil {
			errs = append(errs, err)
		}
	}
	if q.client != nil {
		if err := q.client.Close(); err != nil {
			errs = append(errs, err)
		}
	}
	if len(errs) > 0 {
		return fmt.Errorf("errors closing queue: %v", errs)
	}
	return nil
}

func (q *AsynqQueue) EnqueueSearch(ctx context.Context, deezerID int64) error {
	// Создаем задачу на поиск.
	// Вам нужно будет добавить NewSearchYoutubeTask в пакет tasks
	t, err := tasks.NewSearchYoutubeTask(deezerID)
	if err != nil {
		return fmt.Errorf("failed to create search task: %w", err)
	}

	// Ставим задачу в очередь.
	// MaxRetry(3), так как поиск — это легкий, но зависящий от сети процесс.
	_, err = q.client.Enqueue(t, asynq.MaxRetry(3))
	return err
}
