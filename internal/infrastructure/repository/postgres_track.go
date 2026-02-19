package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"music-go-bot/internal/domain"

	"github.com/Masterminds/squirrel"
	sq "github.com/Masterminds/squirrel"
)

// trackRepo реализует интерфейс domain.TrackRepository
type trackRepo struct {
	db   *sql.DB
	psql sq.StatementBuilderType
}

// NewTrackRepo — конструктор для создания репозитория треков.
// Мы используем PlaceholderFormat(sq.Dollar), так как Postgres не понимает знаки вопроса.
func NewTrackRepo(db *sql.DB) domain.TrackRepository {
	return &trackRepo{
		db:   db,
		psql: sq.StatementBuilder.PlaceholderFormat(sq.Dollar),
	}
}
func (r *trackRepo) AddToUser(ctx context.Context, userID int64, trackID int64) error {
	query, args, err := r.psql.Insert("user_tracks").
		Columns("user_id", "track_id").
		Values(userID, trackID).
		Suffix("ON CONFLICT DO NOTHING"). // Если уже лайкнул — игнорим
		ToSql()

	if err != nil {
		return err
	}

	_, err = r.db.ExecContext(ctx, query, args...)
	return err
}

// Save записывает новый трек в базу данных.
// Используется ON CONFLICT DO NOTHING, чтобы не плодить ошибки, если юзер прислал один и тот же файл дважды.
func (r *trackRepo) Save(ctx context.Context, t *domain.Track) error {
	// Убираем транзакцию, если это единственный запрос
	query, args, err := r.psql.Insert("tracks").
		Columns("deezer_id", "youtube_id", "file_id", "file_unique_id", "title", "artist", "duration", "cover_url", "status").
		Values(t.DeezerID, t.YoutubeID, t.FileID, t.FileUniqueID, t.Title, t.Artist, t.Duration, t.CoverURL, t.Status).
		Suffix(`ON CONFLICT (deezer_id) DO UPDATE SET 
            youtube_id = COALESCE(NULLIF(EXCLUDED.youtube_id, ''), tracks.youtube_id),
            file_id = COALESCE(NULLIF(EXCLUDED.file_id, ''), tracks.file_id),
            file_unique_id = COALESCE(NULLIF(EXCLUDED.file_unique_id, ''), tracks.file_unique_id),
            status = CASE 
                WHEN tracks.status = 'ready' AND EXCLUDED.status = 'processing' THEN tracks.status 
                ELSE EXCLUDED.status 
            END
            RETURNING id`).
		ToSql()

	if err != nil {
		return fmt.Errorf("failed to build query: %w", err)
	}

	// Записываем ID обратно в структуру
	err = r.db.QueryRowContext(ctx, query, args...).Scan(&t.ID)
	if err != nil {
		return fmt.Errorf("failed to upsert track: %w", err)
	}

	return nil
}
func (r *trackRepo) GetByFileUniqueID(ctx context.Context, fileUniqueID string) (*domain.Track, error) {
	// 1. Формируем запрос через Squirrel
	query, args, err := r.psql.Select(
		"id",
		"deezer_id",
		"youtube_id",
		"title",
		"artist",
		"duration",
		"cover_url",
		"file_id",
		"file_unique_id",
		"created_at",
	).
		From("tracks").
		Where(sq.Eq{"file_unique_id": fileUniqueID}).
		ToSql()

	if err != nil {
		return nil, fmt.Errorf("failed to build query: %w", err)
	}

	// 2. Выполняем ОБЯЗАТЕЛЬНО с QueryRowContext(ctx, ...)
	var track domain.Track
	err = r.db.QueryRowContext(ctx, query, args...).Scan(
		&track.ID,
		&track.DeezerID,
		&track.YoutubeID,
		&track.Title,
		&track.Artist,
		&track.Duration,
		&track.CoverURL,
		&track.FileID,
		&track.FileUniqueID,
		&track.CreatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // Трека нет в базе — не ошибка
		}
		return nil, fmt.Errorf("repository.GetByFileUniqueID scan error: %w", err)
	}

	return &track, nil
}

// GetByUserID возвращает все треки конкретного пользователя, отсортированные от новых к старым.
func (r *trackRepo) GetByUserID(ctx context.Context, userID int64) ([]domain.Track, error) {
	// 1. Строим запрос с JOIN, так как треки теперь связаны через user_tracks
	query, args, err := r.psql.Select(
		"t.id",
		"t.deezer_id",
		"t.youtube_id",
		"t.title",
		"t.artist",
		"t.duration",
		"t.cover_url",
		"t.file_id",
		"t.file_unique_id",
		"t.created_at",
	).
		From("tracks t").
		Join("user_tracks ut ON t.id = ut.track_id").
		Where(sq.Eq{"ut.user_id": userID}).
		OrderBy("ut.added_at DESC"). // Сортируем по дате добавления пользователем
		ToSql()

	if err != nil {
		return nil, fmt.Errorf("failed to build query: %w", err)
	}

	// 2. Выполняем запрос с контекстом
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query error: %w", err)
	}
	defer rows.Close()

	var tracks []domain.Track
	for rows.Next() {
		var t domain.Track
		// 3. Сканируем все поля согласно обновленной структуре
		err := rows.Scan(
			&t.ID,
			&t.DeezerID,
			&t.YoutubeID,
			&t.Title,
			&t.Artist,
			&t.Duration,
			&t.CoverURL,
			&t.FileID,
			&t.FileUniqueID,
			&t.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan error: %w", err)
		}
		tracks = append(tracks, t)
	}

	// Проверка на ошибки после итерации
	if err = rows.Err(); err != nil {
		return nil, err
	}

	return tracks, nil
}

// Delete удаляет конкретный трек пользователя по его уникальному ID файла.
func (r *trackRepo) DeleteFromUser(ctx context.Context, userID int64, trackID int64) error {
	// Формируем запрос на удаление связи между юзером и треком
	query, args, err := r.psql.Delete("user_tracks").
		Where(sq.Eq{
			"user_id":  userID,
			"track_id": trackID,
		}).
		ToSql()

	if err != nil {
		return fmt.Errorf("failed to build delete query: %w", err)
	}

	// Выполняем запрос
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("failed to execute delete from user_tracks: %w", err)
	}

	// (Опционально) Можно проверить, было ли что-то удалено
	rows, _ := result.RowsAffected()
	if rows == 0 {
		// Если 0, значит такой связи и не было. Обычно это не считается ошибкой,
		// но полезно для логирования при отладке.
		fmt.Printf("Warning: no link found for user %d and track %d\n", userID, trackID)
	}

	return nil
}

func (r *trackRepo) GetByYoutubeID(ctx context.Context, youtubeID string) (*domain.Track, error) {
	// Строим запрос
	query, args, err := r.psql.Select(
		"id", "youtube_id", "file_id", "file_unique_id",
		"title", "artist", "duration", "created_at",
	).
		From("tracks").
		Where(squirrel.Eq{"youtube_id": youtubeID}).
		Limit(1).
		ToSql()

	if err != nil {
		return nil, err
	}

	var t domain.Track
	err = r.db.QueryRowContext(ctx, query, args...).Scan(
		&t.ID,
		&t.YoutubeID,
		&t.FileID,
		&t.FileUniqueID,
		&t.Title,
		&t.Artist,
		&t.Duration,
		&t.CreatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // Трек еще не кэширован
		}
		return nil, err
	}

	return &t, nil
}
func (r *trackRepo) GetByDeezerID(ctx context.Context, deezerID int64) (*domain.Track, error) {
	query, args, err := r.psql.Select(
		"id",
		"deezer_id",
		"youtube_id",
		"title",
		"artist",
		"duration",
		"cover_url",
		"file_id",
		"file_unique_id",
		"created_at",
		"status",
	).
		From("tracks").
		Where(sq.Eq{"deezer_id": deezerID}).
		Limit(1).
		ToSql()

	if err != nil {
		return nil, fmt.Errorf("failed to build query: %w", err)
	}

	var t domain.Track
	err = r.db.QueryRowContext(ctx, query, args...).Scan(
		&t.ID,
		&t.DeezerID,
		&t.YoutubeID,
		&t.Title,
		&t.Artist,
		&t.Duration,
		&t.CoverURL,
		&t.FileID,
		&t.FileUniqueID,
		&t.CreatedAt,
		&t.Status,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil // Трека нет — это нормальная ситуация для кэша
		}
		return nil, fmt.Errorf("repository.GetByDeezerID scan error: %w", err)
	}

	return &t, nil
}

func (r *trackRepo) UpdateStatus(ctx context.Context, deezerID int64, status string) error {
	// Используем deezer_id как уникальный ключ для поиска
	query := `
        UPDATE tracks 
        SET status = $1, updated_at = NOW() 
        WHERE deezer_id = $2
    `

	result, err := r.db.ExecContext(ctx, query, status, deezerID)
	if err != nil {
		return fmt.Errorf("failed to update track status: %w", err)
	}

	// Проверяем, была ли обновлена хоть одна строка
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("track with deezer_id %d not found", deezerID)
	}

	return nil
}
