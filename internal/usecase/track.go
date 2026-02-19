package usecase

import (
	"context"
	"fmt"
	"log/slog"
	"music-go-bot/internal/domain"
	"music-go-bot/internal/infrastructure/queue"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

type TrackUsecase struct {
	userRepo  domain.UserRepository
	trackRepo domain.TrackRepository
	queue     queue.TrackQueue // Наш новый интерфейс очереди
	bot       *tgbotapi.BotAPI
}

// Обновляем конструктор
func NewTrackUsecase(
	ur domain.UserRepository,
	tr domain.TrackRepository,
	q queue.TrackQueue, // Принимаем интерфейс
	bt *tgbotapi.BotAPI,
) *TrackUsecase {
	return &TrackUsecase{
		userRepo:  ur,
		trackRepo: tr,
		queue:     q,
		bot:       bt,
	}
}

// ГЛАВНЫЙ МЕТОД: Логика принятия решения по проигрыванию
func (u *TrackUsecase) GetPlaybackState(ctx context.Context, dzTrack domain.Track) (domain.PlaybackResult, error) {
	// 1. Проверяем наличие трека в БД или создаем запись
	track, found, err := u.EnsureTrackByDeezer(ctx, dzTrack)
	if err != nil {
		return domain.PlaybackResult{}, fmt.Errorf("ensure track failed: %w", err)
	}

	// 2. Если трек готов (есть FileID) — пытаемся получить прямую ссылку
	if track.FileID != "" {
		link, err := u.GetTelegramFileLink(ctx, track.FileID)
		if err == nil {
			return domain.PlaybackResult{
				Status:   domain.StatusReady,
				PlayLink: link,
			}, nil
		}
		slog.Warn("Telegram link expired or invalid", "deezer_id", track.DeezerID)
		// Если ссылка протухла, идем дальше к перекачиванию
	}

	// 3. Если статус уже "processing", просто возвращаем статус ожидания
	// Это предотвращает дублирование задач в очереди при частом нажатии кнопки
	if track.Status == domain.StatusProcessing && found {
		return domain.PlaybackResult{Status: domain.StatusProcessing}, nil
	}

	// 4. ПОДГОТОВКА К ЗАПУСКУ ЦЕПОЧКИ

	// Сначала фиксируем в базе, что мы начали работу
	track.Status = domain.StatusProcessing
	if err := u.Save(ctx, track); err != nil {
		return domain.PlaybackResult{}, fmt.Errorf("failed to set processing status: %w", err)
	}

	// ПРИНЯТИЕ РЕШЕНИЯ: С чего начинать цепочку?

	if track.YoutubeID == "" {
		// ШАГ А: YouTube ID неизвестен — отправляем на ПОИСК
		slog.Info("Starting workflow from SEARCH", "deezer_id", track.DeezerID)
		err = u.queue.EnqueueSearch(ctx, track.DeezerID)
	} else {
		// ШАГ Б: YouTube ID уже есть — отправляем сразу на СКАЧИВАНИЕ
		slog.Info("Starting workflow from DOWNLOAD", "deezer_id", track.DeezerID, "yt_id", track.YoutubeID)
		err = u.queue.EnqueueDownload(ctx, track.DeezerID, track.YoutubeID)
	}

	if err != nil {
		// Если не удалось положить в очередь, откатываем статус в базе (опционально)
		track.Status = domain.StatusError
		u.Save(ctx, track)
		return domain.PlaybackResult{}, fmt.Errorf("failed to enqueue task: %w", err)
	}

	// Возвращаем пользователю, что процесс пошел
	return domain.PlaybackResult{Status: domain.StatusProcessing}, nil
}

// Вспомогательный метод для получения ссылки из TG
func (u *TrackUsecase) GetTelegramFileLink(ctx context.Context, fileID string) (string, error) {
	file, err := u.bot.GetFile(tgbotapi.FileConfig{FileID: fileID})
	if err != nil {
		return "", err
	}
	return file.Link(u.bot.Token), nil
}
func (u *TrackUsecase) Save(ctx context.Context, track *domain.Track) error {
	// Санитарная проверка
	if track.Title == "" {
		track.Title = "Unknown Track"
	}
	if track.Artist == "" {
		track.Artist = "Unknown Artist"
	}

	if err := u.trackRepo.Save(ctx, track); err != nil {
		return fmt.Errorf("usecase.RegisterTrack: %w", err)
	}
	return nil
}

// SaveTrackToUser — это "бизнес-действие": пользователь сохранил трек себе.
func (u *TrackUsecase) AddTrackToUser(ctx context.Context, user *domain.User, track *domain.Track) error {
	// 1. Сначала обеспечим наличие юзера (это логика UserUC, но допустим оставим тут для простоты)
	if err := u.userRepo.Upsert(user); err != nil {
		return fmt.Errorf("usecase.SaveTrackToUser.UpsertUser: %w", err)
	}

	// 2. Регистрируем сам трек в системе (Шаг 1)
	if err := u.Save(ctx, track); err != nil {
		return err
	}

	// 3. Создаем связь "Пользователь <-> Трек" (Шаг 2)
	// Теперь у track точно есть ID, полученный на предыдущем шаге
	if err := u.trackRepo.AddToUser(ctx, user.ID, track.ID); err != nil {
		return fmt.Errorf("usecase.SaveTrackToUser.LinkToUser: %w", err)
	}

	return nil
}

// GetUserLibrary — Получение песен для Mini App
func (u *TrackUsecase) GetUserLibrary(ctx context.Context, userID int64) ([]domain.Track, error) {
	tracks, err := u.trackRepo.GetByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("usecase.GetUserLibrary: %w", err)
	}

	if tracks == nil {
		return []domain.Track{}, nil
	}

	return tracks, nil
}

// RemoveTrackFromUser — НОВОЕ: Удаляет связь трека с юзером (не сам файл)
func (u *TrackUsecase) RemoveTrackFromUser(ctx context.Context, userID int64, trackID int64) error {
	// Мы вызываем DeleteFromUser, который удалит строку из user_tracks
	if err := u.trackRepo.DeleteFromUser(ctx, userID, trackID); err != nil {
		return fmt.Errorf("usecase.RemoveTrackFromUser: %w", err)
	}
	return nil
}

func (u *TrackUsecase) GetByDeezerID(ctx context.Context, deezerID int64) (*domain.Track, error) {
	track, err := u.trackRepo.GetByDeezerID(ctx, deezerID)
	if err != nil {
		return nil, fmt.Errorf("usecase.GetByDeezerID: %w", err)
	}
	return track, nil
}

func (u *TrackUsecase) EnsureTrackByDeezer(ctx context.Context, dzTrack domain.Track) (*domain.Track, bool, error) {
	// 1. Пытаемся найти в базе
	existing, err := u.trackRepo.GetByDeezerID(ctx, dzTrack.DeezerID)
	if err != nil {
		return nil, false, fmt.Errorf("repo.GetByDeezerID: %w", err)
	}

	// 2. Если нашли — возвращаем как есть (found = true)
	if existing != nil {
		return existing, true, nil
	}

	// 3. Если НЕ нашли — создаем "пустышку" (запись в базе)
	// Устанавливаем начальный статус
	dzTrack.Status = domain.StatusProcessing

	// Сохраняем в репозиторий.
	// ВАЖНО: Repo.Save должен заполнить поле dzTrack.ID после Insert (через RETURNING id)
	if err := u.trackRepo.Save(ctx, &dzTrack); err != nil {
		return nil, false, fmt.Errorf("repo.Save new track: %w", err)
	}

	// Возвращаем созданный трек (found = false, так как его не было до этого момента)
	return &dzTrack, false, nil
}

func (u *TrackUsecase) UpdateTrackStatus(ctx context.Context, trackID int64, status string) error {

	return u.trackRepo.UpdateStatus(ctx, trackID, status)
}
