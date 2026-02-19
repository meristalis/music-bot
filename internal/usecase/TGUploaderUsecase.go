package usecase

import (
	"context"
	"fmt"
	"log/slog"
	"music-go-bot/internal/domain"
	"os"
	"time"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

type TGUploaderUsecase struct {
	repo          domain.TrackRepository
	bot           *tgbotapi.BotAPI
	storageChatID int64
}

func NewTGUploaderUsecase(repo domain.TrackRepository, bot *tgbotapi.BotAPI, storageID int64) *TGUploaderUsecase {
	return &TGUploaderUsecase{
		repo:          repo,
		bot:           bot,
		storageChatID: storageID,
	}
}

func (u *TGUploaderUsecase) UploadFile(ctx context.Context, deezerID int64, filePath string) error {
	// Важно: удаляем файл только после попытки загрузки
	defer os.Remove(filePath)

	// 1. Получаем инфо о треке из базы для метаданных
	track, err := u.repo.GetByDeezerID(ctx, deezerID)
	if err != nil {
		return fmt.Errorf("repo.GetByDeezerID: %w", err)
	}
	if track == nil {
		return fmt.Errorf("track %d not found", deezerID)
	}

	l := slog.With("track_id", track.ID, "file", filePath)
	l.Info("Начало загрузки файла в Telegram...")

	// 2. Формируем аудио сообщение
	audioCfg := tgbotapi.NewAudio(u.storageChatID, tgbotapi.FilePath(filePath))
	audioCfg.Title = track.Title
	audioCfg.Performer = track.Artist
	audioCfg.Duration = track.Duration

	// 3. Отправка
	start := time.Now()
	msg, err := u.bot.Send(audioCfg)
	if err != nil {
		track.Status = "error"
		u.repo.Save(ctx, track)
		return fmt.Errorf("bot.Send: %w", err)
	}

	if msg.Audio == nil {
		return fmt.Errorf("telegram returned no audio metadata")
	}

	// 4. Сохраняем результат
	track.FileID = msg.Audio.FileID
	track.FileUniqueID = msg.Audio.FileUniqueID
	track.Status = domain.StatusReady

	if err := u.repo.Save(ctx, track); err != nil {
		return fmt.Errorf("failed to save file_id: %w", err)
	}

	l.Info("Файл успешно загружен", "took", time.Since(start).String())
	return nil
}
