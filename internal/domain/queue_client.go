package domain

import "context"

type QueueClient interface {
	// Вызывается из API Handler
	EnqueueDownload(ctx context.Context, trackID int64, ytID string) error
	// Вызывается из YTDownloaderUsecase
	EnqueueUpload(ctx context.Context, trackID int64, filePath string) error
}
