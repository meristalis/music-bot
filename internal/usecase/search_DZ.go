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

type DeezerArtistResponse struct {
	Data []struct {
		ID            int64  `json:"id"`
		Name          string `json:"name"`
		PictureMedium string `json:"picture_medium"`
		NbAlbum       int    `json:"nb_album"`
	} `json:"data"`
}

type DeezerAlbumResponse struct {
	Data []struct {
		ID          int64  `json:"id"`
		Title       string `json:"title"`
		CoverMedium string `json:"cover_medium"`
		Artist      struct {
			Name string `json:"name"`
		} `json:"artist"`
	} `json:"data"`
}

// --- НОВОЕ: Структуры для экрана артиста ---

type DeezerArtistDetail struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	PictureMedium string `json:"picture_medium"`
	PictureXL     string `json:"picture_xl"`
	NbFan         int    `json:"nb_fan"`
	NbAlbum       int    `json:"nb_album"`
}

type DeezerAlbumDetail struct {
	ID          int64  `json:"id"`
	Title       string `json:"title"`
	CoverMedium string `json:"cover_medium"`
	ReleaseDate string `json:"release_date"`
	NbTracks    int    `json:"nb_tracks"`
	Artist      struct {
		Name string `json:"name"`
	} `json:"artist"`
	Tracks struct {
		Data []struct {
			ID       int64  `json:"id"`
			Title    string `json:"title"`
			Duration int    `json:"duration"`
		} `json:"data"`
	} `json:"tracks"`
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

// SearchDeezer — Поиск треков
func (s *SearchUsecaseDZ) SearchDeezer(ctx context.Context, query string) ([]domain.Track, error) {
	u, _ := url.Parse("https://api.deezer.com/search/track")
	q := u.Query()
	q.Set("q", query)
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var dzResp DeezerSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&dzResp); err != nil {
		return nil, err
	}

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

// --- ИСПРАВЛЕНО: Поиск артистов ---
func (s *SearchUsecaseDZ) SearchArtists(ctx context.Context, query string) ([]interface{}, error) {
	// 1. Формируем URL для поиска артистов
	u, err := url.Parse("https://api.deezer.com/search/artist")
	if err != nil {
		return nil, err
	}

	q := u.Query()
	q.Set("q", query)
	u.RawQuery = q.Encode()

	// 2. Выполняем запрос
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("deezer artist api call failed: %w", err)
	}
	defer resp.Body.Close()

	// 3. Декодируем
	var dzResp DeezerArtistResponse
	if err := json.NewDecoder(resp.Body).Decode(&dzResp); err != nil {
		return nil, fmt.Errorf("failed to decode artist response: %w", err)
	}

	// 4. Мапим в слайс интерфейсов (чтобы Handler легко проглотил JSON)
	// Либо можно создать доменную модель Artist, если она нужна в базе
	result := make([]interface{}, 0, len(dzResp.Data))
	for _, a := range dzResp.Data {
		result = append(result, map[string]interface{}{
			"id":             a.ID,
			"name":           a.Name,
			"picture_medium": a.PictureMedium,
			"nb_album":       a.NbAlbum,
		})
	}

	return result, nil
}

// SearchAlbums — Поиск альбомов через Deezer API
func (s *SearchUsecaseDZ) SearchAlbums(ctx context.Context, query string) ([]interface{}, error) {
	// 1. Подготовка URL
	u, err := url.Parse("https://api.deezer.com/search/album")
	if err != nil {
		return nil, err
	}

	q := u.Query()
	q.Set("q", query)
	u.RawQuery = q.Encode()

	// 2. Выполнение запроса
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create album request: %w", err)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("deezer album api call failed: %w", err)
	}
	defer resp.Body.Close()

	// 3. Декодирование
	var dzResp DeezerAlbumResponse
	if err := json.NewDecoder(resp.Body).Decode(&dzResp); err != nil {
		return nil, fmt.Errorf("failed to decode album response: %w", err)
	}

	// 4. Мапинг в слайс (ID, название, обложка, имя артиста)
	result := make([]interface{}, 0, len(dzResp.Data))
	for _, a := range dzResp.Data {
		result = append(result, map[string]interface{}{
			"id":           a.ID,
			"title":        a.Title,
			"cover_medium": a.CoverMedium,
			"artist_name":  a.Artist.Name,
		})
	}

	return result, nil
}

// GetArtistByID — Информация об артисте
func (s *SearchUsecaseDZ) GetArtistByID(ctx context.Context, id string) (interface{}, error) {
	apiURL := fmt.Sprintf("https://api.deezer.com/artist/%s", id)

	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var detail DeezerArtistDetail
	if err := json.NewDecoder(resp.Body).Decode(&detail); err != nil {
		return nil, err
	}
	return detail, nil
}

// GetArtistTopTracks — Популярные треки артиста
func (s *SearchUsecaseDZ) GetArtistTopTracks(ctx context.Context, id string) ([]domain.Track, error) {
	apiURL := fmt.Sprintf("https://api.deezer.com/artist/%s/top?limit=10", id)

	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var dzResp DeezerSearchResponse // структура совпадает
	if err := json.NewDecoder(resp.Body).Decode(&dzResp); err != nil {
		return nil, err
	}

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

// GetArtistAlbums — Список альбомов артиста
func (s *SearchUsecaseDZ) GetArtistAlbums(ctx context.Context, id string) ([]interface{}, error) {
	apiURL := fmt.Sprintf("https://api.deezer.com/artist/%s/albums", id)

	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var dzResp DeezerAlbumResponse // структура совпадает
	if err := json.NewDecoder(resp.Body).Decode(&dzResp); err != nil {
		return nil, err
	}

	result := make([]interface{}, 0, len(dzResp.Data))
	for _, a := range dzResp.Data {
		result = append(result, map[string]interface{}{
			"id":           a.ID,
			"title":        a.Title,
			"cover_medium": a.CoverMedium,
			"artist_name":  a.Artist.Name,
		})
	}
	return result, nil
}

// GetAlbumByID — Детальная информация об альбоме вместе с треками
func (s *SearchUsecaseDZ) GetAlbumByID(ctx context.Context, id string) (interface{}, error) {
	apiURL := fmt.Sprintf("https://api.deezer.com/album/%s", id)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("deezer album detail api call failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("deezer api returned status: %d", resp.StatusCode)
	}

	var detail DeezerAlbumDetail
	if err := json.NewDecoder(resp.Body).Decode(&detail); err != nil {
		return nil, fmt.Errorf("failed to decode album detail: %w", err)
	}

	return detail, nil
}
