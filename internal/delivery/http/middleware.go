package http

import (
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

// LoggerMiddleware логирует каждый чих фронтенда
func LoggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		t := time.Now()

		// Перед выполнением запроса
		c.Next()

		// После выполнения запроса
		latency := time.Since(t)
		status := c.Writer.Status()
		method := c.Request.Method
		path := c.Request.URL.Path

		log.Printf("[GIN] %v | %d | %s | %s | %v",
			t.Format("15:04:05"),
			status,
			method,
			path,
			latency,
		)
	}
}

// CORSMiddleware разрешает запросы с твоих туннелей Serveo
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}
