package repository

import (
	"database/sql"
	"music-go-bot/internal/domain"

	sq "github.com/Masterminds/squirrel"
)

type userRepo struct {
	db   *sql.DB
	psql sq.StatementBuilderType
}

func NewUserRepo(db *sql.DB) domain.UserRepository {
	return &userRepo{
		db:   db,
		psql: sq.StatementBuilder.PlaceholderFormat(sq.Dollar),
	}
}

// Upsert — просто сохраняет или обновляет запись в БД
func (r *userRepo) Upsert(u *domain.User) error {
	query, args, err := r.psql.Insert("users").
		Columns("id", "username", "first_name").
		Values(u.ID, u.Username, u.FirstName).
		Suffix("ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, first_name = EXCLUDED.first_name").
		ToSql()

	if err != nil {
		return err
	}

	_, err = r.db.Exec(query, args...)
	return err
}

// GetByID — просто тянет юзера из БД
func (r *userRepo) GetByID(id int64) (*domain.User, error) {
	query, args, err := r.psql.Select("id", "username", "first_name", "created_at").
		From("users").
		Where(sq.Eq{"id": id}).
		ToSql()

	if err != nil {
		return nil, err
	}

	u := &domain.User{}
	err = r.db.QueryRow(query, args...).Scan(&u.ID, &u.Username, &u.FirstName, &u.CreatedAt)
	return u, err
}
