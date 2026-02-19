package http

import "github.com/gin-gonic/gin"

// Используем твой тип Handler, который мы определили ранее
func InitRouter(h *Handler) *gin.Engine {
	r := gin.New()

	// 1. Сначала подключаем глобальные прослойки
	r.Use(LoggerMiddleware())
	r.Use(CORSMiddleware())
	r.Use(gin.Recovery())

	// 2. Делегируем регистрацию путей самому хендлеру
	// Это и есть чистый подход: роутер создает каркас,
	// а хендлер сам говорит, какие пути он обслуживает.
	h.RegisterRoutes(r)

	return r
}
