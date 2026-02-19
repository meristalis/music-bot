package main

import (
	"context"
	"database/sql"
	"log"
	"log/slog"
	"os"
	"os/signal"
	"strconv"
	"syscall"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"github.com/hibiken/asynq"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"

	"music-go-bot/internal/delivery/asynq_delivery"
	"music-go-bot/internal/delivery/http"
	"music-go-bot/internal/delivery/telegram"
	"music-go-bot/internal/domain"
	"music-go-bot/internal/infrastructure/queue"
	"music-go-bot/internal/infrastructure/repository"
	"music-go-bot/internal/logger"
	"music-go-bot/internal/tasks"
	"music-go-bot/internal/usecase"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// 1-5. (Загрузка .env, Логи, DB, Бот — без изменений)
	godotenv.Load()
	logger.Setup(os.Getenv("LOG_LEVEL"))

	storageID, _ := strconv.ParseInt(os.Getenv("STORAGE_CHAT_ID"), 10, 64)
	dsn := os.Getenv("DB_URL")
	db, _ := sql.Open("postgres", dsn)

	botToken := os.Getenv("BOT_TOKEN")
	bot, _ := tgbotapi.NewBotAPI(botToken)

	// 6. Настройка Redis и Очереди
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
	asynqQueue := queue.NewAsynqQueue(redisAddr)
	defer asynqQueue.Close()

	// 7. Сборка слоев (Clean Architecture)
	userRepo := repository.NewUserRepo(db)
	trackRepo := repository.NewTrackRepo(db)
	searchUsecaseDZ := usecase.NewSearchUsecaseDZ()

	userUsecase := usecase.NewUserUsecase(userRepo)

	// TrackUsecase — "входные ворота", ставит задачу на Download
	trackUsecase := usecase.NewTrackUsecase(userRepo, trackRepo, asynqQueue, bot)

	// --- ОБНОВЛЕННЫЕ USECASE ДЛЯ ВОРКЕРОВ ---
	ytSearcherUC := usecase.NewSearchUsecaseYT(trackRepo, asynqQueue)
	// 1. Только скачивание (нужен repo и очередь)
	ytDownloaderUC := usecase.NewYTDownloaderUsecase(trackRepo, asynqQueue)

	// 2. Только загрузка (нужен repo, бот и ID хранилища)
	tgUploaderUC := usecase.NewTGUploaderUsecase(trackRepo, bot, storageID)

	// 8. Настройка Воркера (Asynq Server)
	srv := asynq.NewServer(
		asynq.RedisClientOpt{Addr: redisAddr},
		asynq.Config{
			Concurrency: 10,
			Queues: map[string]int{
				"critical": 6,
				"default":  3,
			},
			// ВОТ ЭТОТ БЛОК
			ErrorHandler: asynq.ErrorHandlerFunc(func(ctx context.Context, task *asynq.Task, err error) {
				retried, _ := asynq.GetRetryCount(ctx)
				maxRetry, _ := asynq.GetMaxRetry(ctx)

				// Если задача провалилась окончательно
				if retried >= maxRetry {
					// Используем твою новую функцию из пакета tasks
					id := tasks.ExtractID(task)
					if id != 0 {
						slog.Error("Final task failure, marking track as ERROR in DB",
							"deezer_id", id,
							"task_type", task.Type(),
							"error", err,
						)
						// Обновляем статус в базе
						_ = trackRepo.UpdateStatus(context.Background(), id, domain.StatusError)
					}
				}
			}),
		},
	)

	// Передаем оба юзкейса в хендлер
	asynqHandler := asynq_delivery.NewTaskHandler(ytSearcherUC, ytDownloaderUC, tgUploaderUC)
	mux := asynq.NewServeMux()

	// Твой хендлер сам знает, какие типы задач к каким методам привязать
	asynqHandler.Register(mux)

	go func() {
		slog.Info("Worker is running with Task Chaining...")
		if err := srv.Run(mux); err != nil {
			log.Fatalf("could not run asynq server: %v", err)
		}
	}()

	// 9-10. (Запуск API и Бота — без изменений)
	handler := http.NewHandler(trackUsecase, searchUsecaseDZ, userUsecase, asynqQueue)
	router := http.InitRouter(handler)

	go func() {
		port := os.Getenv("PORT")
		if port == "" {
			port = "8080"
		}
		router.Run(":" + port)
	}()

	botHandler := telegram.NewBotHandler(bot, trackUsecase, userUsecase)
	slog.Info("Telegram Bot is running...")
	botHandler.Start(ctx)

	slog.Info("Shutdown complete.")
}
