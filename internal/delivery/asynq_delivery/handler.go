package asynq_delivery

import (
	"context"
	"encoding/json"
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
		return err
	}

	// Внутри Download произойдет скачивание и вызов EnqueueUpload
	return h.ytUC.Download(ctx, p.TrackID, p.YoutubeID)
}

// 3. Обработка загрузки в ТГ
func (h *TaskHandler) HandleUploadTask(ctx context.Context, t *asynq.Task) error {
	var p tasks.TelegramUploadPayload
	if err := json.Unmarshal(t.Payload(), &p); err != nil {
		return err
	}

	return h.tgUC.UploadFile(ctx, p.TrackID, p.FilePath)
}
