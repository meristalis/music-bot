package http

import (
	"log/slog"
	"music-go-bot/internal/domain"
	"music-go-bot/internal/infrastructure/queue"
	"music-go-bot/internal/usecase"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	trackUc    *usecase.TrackUsecase
	searchYTUc *usecase.YTSearcherUsecase
	searchDZUC *usecase.SearchUsecaseDZ
	userUC     *usecase.UserUsecase
	queue      *queue.AsynqQueue
}

func NewHandler(
	trackUC *usecase.TrackUsecase,
	searchDZUC *usecase.SearchUsecaseDZ,
	userUC *usecase.UserUsecase,
	queue *queue.AsynqQueue,
) *Handler {
	return &Handler{
		trackUc:    trackUC,
		searchDZUC: searchDZUC,
		userUC:     userUC,
		queue:      queue,
	}
}

func (h *Handler) RegisterRoutes(r *gin.Engine) {
	r.Use(gin.Recovery())

	api := r.Group("/api")
	{
		api.POST("/tracks/play", h.HandlePlay)
		api.GET("/tracks/stream/:file_id", h.StreamTrack)
		api.GET("/tracks", h.GetTracks)
		api.GET("/search/deezer", h.SearchTracksDZ)
		api.POST("/tracks/like", h.HandleLike)
		api.POST("/tracks/unlike", h.HandleUnlike)
		api.GET("/tracks/status/:id", h.CheckStatus)
		api.GET("/queue/stats", h.GetQueueStats)
	}
}

func (h *Handler) StreamTrack(c *gin.Context) {
	fileID := c.Param("file_id")

	// Пробрасываем контекст запроса c.Request.Context()
	fileURL, err := h.trackUc.GetTelegramFileLink(c.Request.Context(), fileID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get file link"})
		return
	}

	// Просто перенаправляем плеер на сервер Телеграма
	c.Redirect(http.StatusTemporaryRedirect, fileURL)
}

func (h *Handler) GetTracks(c *gin.Context) {
	userIDParam := c.Query("user_id")
	userID, err := strconv.ParseInt(userIDParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user_id"})
		return
	}

	// Передаем контекст запроса в Usecase -> Repository -> DB
	tracks, err := h.trackUc.GetUserLibrary(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tracks)
}

func (h *Handler) SearchTracksDZ(c *gin.Context) {
	// Используем strings.TrimSpace для удаления лишних пробелов по краям
	query := strings.TrimSpace(c.Query("q"))

	if query == "" {
		// Если после обрезки строка пустая, не мучаем Deezer
		c.JSON(http.StatusOK, []interface{}{}) // Возвращаем пустой список вместо ошибки 400
		return
	}

	tracks, err := h.searchDZUC.SearchDeezer(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to search Deezer"})
		return
	}

	c.JSON(http.StatusOK, tracks)
}

func (h *Handler) HandlePlay(c *gin.Context) {
	ctx := c.Request.Context()

	var req struct {
		DeezerID int64  `json:"deezer_id"`
		Title    string `json:"title"`
		Artist   string `json:"artist"`
		CoverURL string `json:"cover_url"`
		Duration int    `json:"duration"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		slog.Warn("Invalid request body", "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	track := domain.Track{
		DeezerID: req.DeezerID,
		Title:    req.Title,
		Artist:   req.Artist,
		CoverURL: req.CoverURL,
		Duration: req.Duration,
	}

	// Логируем начало процесса
	slog.Info("Playback request received",
		"deezer_id", req.DeezerID,
		"track", req.Artist+" - "+req.Title,
	)

	result, err := h.trackUc.GetPlaybackState(ctx, track)
	if err != nil {
		slog.Error("Failed to get playback state",
			"deezer_id", req.DeezerID,
			"error", err,
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process track"})
		return
	}

	switch result.Status {
	case domain.StatusReady:
		slog.Info("Track is ready", "deezer_id", req.DeezerID)
		c.JSON(http.StatusOK, gin.H{
			"status":    "ready",
			"play_link": result.PlayLink,
		})

	case domain.StatusProcessing:
		slog.Debug("Track is being processed", "deezer_id", req.DeezerID)
		c.JSON(http.StatusAccepted, gin.H{
			"status":    "processing",
			"deezer_id": req.DeezerID,
		})
	}
}

type LikeRequest struct {
	UserID   int64  `json:"user_id"`
	DeezerID int64  `json:"deezer_id"`
	Title    string `json:"title"`
	Artist   string `json:"artist"`
	CoverURL string `json:"cover_url"`
}

func (h *Handler) HandleLike(c *gin.Context) {
	var req LikeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "invalid format"})
		return
	}

	ctx := c.Request.Context()

	// 1. Проверяем наличие пользователя в базе
	// (Метод GetByID должен вернуть ошибку, если юзера нет)
	_, err := h.userUC.GetByID(ctx, req.UserID)
	if err != nil {
		c.JSON(404, gin.H{"error": "user not found in database"})
		return
	}

	// 2. Ищем трек по DeezerID
	// (Метод GetByDeezerID возвращает существующий трек с внутренним ID)
	existingTrack, err := h.trackUc.GetByDeezerID(ctx, req.DeezerID)
	if err != nil {
		c.JSON(404, gin.H{"error": "track not found in system (must be played first)"})
		return
	}

	// 3. Если всё нашли — создаем связь
	user := &domain.User{ID: req.UserID}
	err = h.trackUc.AddTrackToUser(ctx, user, existingTrack)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to link track: " + err.Error()})
		return
	}

	c.JSON(200, gin.H{"status": "success"})
}
func (h *Handler) HandleUnlike(c *gin.Context) {
	var req LikeRequest // Используем ту же структуру, что и для Like
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "invalid format"})
		return
	}

	ctx := c.Request.Context()

	// 1. Проверяем трек (нужно получить его внутренний ID)
	track, err := h.trackUc.GetByDeezerID(ctx, req.DeezerID)
	if err != nil {
		c.JSON(404, gin.H{"error": "track not found"})
		return
	}

	err = h.trackUc.RemoveTrackFromUser(ctx, req.UserID, track.ID)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to remove like"})
		return
	}

	c.JSON(200, gin.H{"status": "unliked"})
}
func (h *Handler) CheckStatus(c *gin.Context) {
	idStr := c.Param("id")
	deezerID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid deezer id"})
		return
	}

	// 1. Получаем данные
	track, err := h.trackUc.GetByDeezerID(c.Request.Context(), deezerID)

	// 2. СРАЗУ проверяем на ошибку БД или на nil
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db error"})
		return
	}

	if track == nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "not_found", "error": "track not in database"})
		return
	}

	// 3. Теперь БЕЗОПАСНО создаем ответ, так как мы уверены, что track != nil
	response := gin.H{
		"status":    track.Status,
		"deezer_id": track.DeezerID,
		"title":     track.Title,
		"artist":    track.Artist,
		"cover_url": track.CoverURL,
	}

	// 4. Если готов — пробуем получить ссылку
	if track.Status == "ready" && track.FileID != "" {
		fileLink, err := h.trackUc.GetTelegramFileLink(c.Request.Context(), track.FileID)
		if err == nil {
			response["play_link"] = fileLink
			response["file_id"] = track.FileID
			response["track_id"] = track.ID // полезно для фронта
		}
	}

	c.JSON(http.StatusOK, response)
}

func (h *Handler) GetQueueStats(c *gin.Context) {
	seconds, err := h.queue.GetEstimatedWaitTime()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"seconds": seconds,
	})
}
