package telegram

import (
	"context"
	"fmt"
	"log"
	"music-go-bot/internal/domain"
	"music-go-bot/internal/usecase"
	"time"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

type BotHandler struct {
	bot     *tgbotapi.BotAPI
	trackUC *usecase.TrackUsecase
	userUc  *usecase.UserUsecase
}

func NewBotHandler(bot *tgbotapi.BotAPI, trackUC *usecase.TrackUsecase, userUc *usecase.UserUsecase) *BotHandler {
	return &BotHandler{
		bot:     bot,
		trackUC: trackUC,
		userUc:  userUc,
	}
}

func (h *BotHandler) Start(ctx context.Context) {
	u := tgbotapi.NewUpdate(0)
	u.Timeout = 60
	updates := h.bot.GetUpdatesChan(u)

	log.Println("Bot handler started...")

	for {
		select {
		case <-ctx.Done():
			log.Println("Stopping bot handler...")
			return
		case update, ok := <-updates:
			if !ok {
				return
			}
			if update.Message == nil {
				continue
			}

			// Для каждой обработки создаем свой контекст с таймаутом,
			// чтобы один зависший запрос не вешал всё приложение.
			handleCtx, cancel := context.WithTimeout(ctx, 30*time.Second)

			if update.Message.Audio != nil {
				h.handleAudio(handleCtx, update.Message)
			}

			// Если будет команда /start для Mini App
			if update.Message.IsCommand() && update.Message.Command() == "start" {
				h.handleStart(update.Message)
			}

			cancel() // Освобождаем ресурсы контекста
		}
	}
}

func (h *BotHandler) handleAudio(ctx context.Context, msg *tgbotapi.Message) {
	user := &domain.User{
		ID:        msg.From.ID,
		Username:  msg.From.UserName,
		FirstName: msg.From.FirstName,
	}

	track := &domain.Track{
		FileID:       msg.Audio.FileID,
		FileUniqueID: msg.Audio.FileUniqueID,
		Title:        msg.Audio.Title,
		Artist:       msg.Audio.Performer,
		Duration:     msg.Audio.Duration,
	}

	// ВЫТЯГИВАЕМ ОБЛОЖКУ
	if msg.Audio.Thumbnail != nil {
		// Получаем прямую ссылку на фото через API Telegram
		thumbURL, err := h.bot.GetFileDirectURL(msg.Audio.Thumbnail.FileID)
		if err == nil {
			track.CoverURL = thumbURL
		}
	}

	// 1. Сохраняем/обновляем сам трек в глобальном реестре
	// После этого в track.ID запишется ID из базы
	if err := h.trackUC.Save(ctx, track); err != nil {
		log.Printf("Error saving track entity: %v", err)
		h.bot.Send(tgbotapi.NewMessage(msg.Chat.ID, "❌ Не удалось сохранить информацию о треке."))
		return
	}

	// 2. Привязываем трек к пользователю (Добавляем в библиотеку)
	if err := h.trackUC.AddTrackToUser(ctx, user, track); err != nil {
		log.Printf("Error linking track to user: %v", err)
		h.bot.Send(tgbotapi.NewMessage(msg.Chat.ID, "❌ Не удалось добавить трек в твою библиотеку."))
		return
	}

	msgRes := tgbotapi.NewMessage(msg.Chat.ID, "✅ Трек успешно добавлен в твою медиатеку!")
	msgRes.ReplyToMessageID = msg.MessageID
	h.bot.Send(msgRes)
}

func (h *BotHandler) handleStart(msg *tgbotapi.Message) {
	// 1. Сохраняем или обновляем пользователя в базе
	user := &domain.User{
		ID:        msg.From.ID,
		FirstName: msg.From.FirstName,
		Username:  msg.From.UserName,
	}

	// Контекст обычно берется фоновый для операций в боте
	ctx := context.Background()
	err := h.userUc.UpsertUser(ctx, user)
	if err != nil {
		log.Printf("Ошибка при регистрации пользователя %d: %v", msg.From.ID, err)
		// Не блокируем работу бота, если база прилегла, но логируем
	}

	// 2. Формируем текст сообщения
	txt := fmt.Sprintf(
		"Привет, %s!\n\n"+
			"Твой Chat ID: `%d` (нажми, чтобы скопировать)\n\n"+
			"Жми на кнопку ниже, чтобы открыть свою медиатеку.",
		msg.From.FirstName,
		msg.From.ID, // Используем ID отправителя
	)

	reply := tgbotapi.NewMessage(msg.Chat.ID, txt)
	reply.ParseMode = "Markdown"

	// Добавим кнопку открытия Mini App (если она у тебя настроена)
	// reply.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(...)

	h.bot.Send(reply)
}
