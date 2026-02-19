package domain

import "time"

type User struct {
	ID        int64     `json:"id"`
	Username  string    `json:"username"`
	FirstName string    `json:"first_name"`
	CreatedAt time.Time `json:"created_at"`
}

// UserRepository — контракт для работы с юзерами
type UserRepository interface {
	Upsert(user *User) error
	GetByID(id int64) (*User, error)
}
