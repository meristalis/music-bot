package tasks

import (
	"encoding/json"

	"github.com/hibiken/asynq"
)

const (
	TypeDownloadYoutube = "download:youtube"
	TypeTelegramUpload  = "telegram:upload"
	TypeYoutubeSearch   = "youtube:search"
)

type DownloadYoutubePayload struct {
	TrackID   int64  `json:"track_id"`
	YoutubeID string `json:"youtube_id"`
}
type TelegramUploadPayload struct {
	TrackID  int64  `json:"track_id"`
	FilePath string `json:"file_path"`
	UserID   int64  `json:"user_id"` // Чтобы знать, кому отправить уведомление "Готово"
}
type SearchYoutubePayload struct {
	DeezerID int64
}

// Вспомогательная функция для создания задачи
func NewDownloadYoutubeTask(trackID int64, youtubeID string) (*asynq.Task, error) {
	payload, err := json.Marshal(DownloadYoutubePayload{
		TrackID:   trackID,
		YoutubeID: youtubeID,
	})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeDownloadYoutube, payload), nil
}

func NewTelegramUploadTask(trackID int64, filePath string) (*asynq.Task, error) {
	payload, err := json.Marshal(TelegramUploadPayload{
		TrackID:  trackID,
		FilePath: filePath,
	})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeTelegramUpload, payload), nil
}

func NewSearchYoutubeTask(deezerID int64) (*asynq.Task, error) {
	payload, err := json.Marshal(SearchYoutubePayload{DeezerID: deezerID})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeYoutubeSearch, payload), nil
}
func ExtractID(t *asynq.Task) int64 {
	var data struct {
		DeezerID int64 `json:"DeezerID"`
		TrackID  int64 `json:"TrackID"`
	}
	if err := json.Unmarshal(t.Payload(), &data); err != nil {
		return 0
	}
	if data.DeezerID != 0 {
		return data.DeezerID
	}
	return data.TrackID
}
