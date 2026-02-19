package asynq_delivery

import (
	"context"
	"encoding/json"
	"log/slog"
	"music-go-bot/internal/tasks"
	"music-go-bot/internal/usecase"

	"github.com/hibiken/asynq"
)

type TaskHandler struct {
	searchUC *usecase.YTSearcherUsecase // Новое звено
	ytUC     *usecase.YTDownloaderUsecase
	tgUC     *usecase.TGUploaderUsecase
}

func NewTaskHandler(
	searcher *usecase.YTSearcherUsecase,
	yt *usecase.YTDownloaderUsecase,
	tg *usecase.TGUploaderUsecase,
) *TaskHandler {
	return &TaskHandler{
		searchUC: searcher,
		ytUC:     yt,
		tgUC:     tg,
	}
}

func (h *TaskHandler) Register(mux *asynq.ServeMux) {
	// Регистрируем все три этапа
	mux.HandleFunc(tasks.TypeYoutubeSearch, h.HandleSearchTask)
	mux.HandleFunc(tasks.TypeDownloadYoutube, h.HandleDownloadTask)
	mux.HandleFunc(tasks.TypeTelegramUpload, h.HandleUploadTask)
}

// 1. Обработка поиска
func (h *TaskHandler) HandleSearchTask(ctx context.Context, t *asynq.Task) error {
	var p tasks.SearchYoutubePayload
	if err := json.Unmarshal(t.Payload(), &p); err != nil {
		return err
	}

	// Вызываем поиск. Внутри него (как мы писали ранее)
	// произойдет сохранение ID и вызов EnqueueDownload
	return h.searchUC.ExecuteSearch(ctx, p.DeezerID)
}

// 2. Обработка скачивания
func (h *TaskHandler) HandleDownloadTask(ctx context.Context, t *asynq.Task) error {
	var p tasks.DownloadYoutubePayload
	if err := json.Unmarshal(t.Payload(), &p); err != nil {
		slog.Error("Failed to unmarshal download payload", "error", err)
		return err
	}

	slog.Info("Worker: starting download stage", "track_id", p.TrackID, "yt_id", p.YoutubeID)

	err := h.ytUC.Download(ctx, p.TrackID, p.YoutubeID)
	if err != nil {
		slog.Error("Worker: download stage failed", "error", err, "track_id", p.TrackID)
		return err // Asynq увидит ошибку и попробует позже
	}

	slog.Info("Worker: download stage completed", "track_id", p.TrackID)
	return nil
}

// 3. Обработка загрузки в ТГ
func (h *TaskHandler) HandleUploadTask(ctx context.Context, t *asynq.Task) error {
	var p tasks.TelegramUploadPayload
	if err := json.Unmarshal(t.Payload(), &p); err != nil {
		return err
	}

	return h.tgUC.UploadFile(ctx, p.TrackID, p.FilePath)
}
