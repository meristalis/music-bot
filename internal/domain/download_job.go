package domain

import (
	"context"
)

type DownloadJob struct {
	Track *Track
	Ctx   context.Context
}
