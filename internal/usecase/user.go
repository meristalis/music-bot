package usecase

import (
	"context"
	"errors"
	"music-go-bot/internal/domain"
)

type UserUsecase struct {
	userRepo domain.UserRepository
}

func NewUserUsecase(repo domain.UserRepository) *UserUsecase {
	return &UserUsecase{
		userRepo: repo,
	}
}

func (u *UserUsecase) GetByID(ctx context.Context, id int64) (*domain.User, error) {
	user, err := u.userRepo.GetByID(id)
	if err != nil {
		return nil, errors.New("user not found")
	}
	return user, nil
}

func (u *UserUsecase) UpsertUser(ctx context.Context, user *domain.User) error {
	if user.ID == 0 {
		return errors.New("invalid user id")
	}
	return u.userRepo.Upsert(user)
}
