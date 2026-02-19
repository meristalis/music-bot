package usecase

import (
	"context"
	"encoding/json"
	"fmt"
	"music-go-bot/internal/domain"
	"net/http"
	"net/url"
	"time"
)

// DeezerSearchResponse описывает структуру ответа от API
type DeezerSearchResponse struct {
	Data []struct {
		ID       int64  `json:"id"`
		Title    string `json:"title"`
		Duration int    `json:"duration"`
		Artist   struct {
			Name string `json:"name"`
		} `json:"artist"`
		Album struct {
			CoverMedium string `json:"cover_medium"`
		} `json:"album"`
	} `json:"data"`
}

type SearchUsecaseDZ struct {
	client *http.Client
}

func NewSearchUsecaseDZ() *SearchUsecaseDZ {
	return &SearchUsecaseDZ{
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// SearchDeezer выполняет поиск треков через официальное API Deezer
func (s *SearchUsecaseDZ) SearchDeezer(ctx context.Context, query string) ([]domain.Track, error) {
	// 1. Подготовка URL (экранируем пробелы и спецсимволы в запросе)
	baseURL := "https://api.deezer.com/search/track"
	u, err := url.Parse(baseURL)
	if err != nil {
		return nil, err
	}

	q := u.Query()
	q.Set("q", query)
	u.RawQuery = q.Encode()

	// 2. Создаем HTTP-запрос с поддержкой контекста
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create deezer request: %w", err)
	}

	// 3. Выполняем запрос
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("deezer api call failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("deezer api returned error status: %d", resp.StatusCode)
	}

	// 4. Парсим JSON
	var dzResp DeezerSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&dzResp); err != nil {
		return nil, fmt.Errorf("failed to decode deezer response: %w", err)
	}

	// 5. Конвертируем в доменные модели
	tracks := make([]domain.Track, 0, len(dzResp.Data))
	for _, d := range dzResp.Data {
		tracks = append(tracks, domain.Track{
			DeezerID: d.ID,
			Title:    d.Title,
			Artist:   d.Artist.Name,
			Duration: d.Duration,
			CoverURL: d.Album.CoverMedium,
		})
	}

	return tracks, nil
}
