package logger

import (
	"log/slog"
	"os"
	"sync"
)

var once sync.Once

// Setup инициализирует глобальный логгер.
// env: "prod" для JSON-логов, остальное — обычный текст.
func Setup(env string) {
	once.Do(func() {
		var handler slog.Handler

		if env == "prod" {
			// В продакшене используем JSON для систем сбора логов (Loki, ELK)
			handler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
				Level: slog.LevelInfo,
			})
		} else {
			// Для локальной разработки — читаемый текстовый формат
			handler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
				Level: slog.LevelDebug,
			})
		}

		logger := slog.New(handler)

		slog.SetDefault(logger)
	})
}
