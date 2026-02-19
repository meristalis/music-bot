# Сборка
FROM golang:1.25-alpine AS builder
WORKDIR /app
ENV GOPROXY=https://proxy.golang.org,direct
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Собираем бинарник
RUN go build -o main ./cmd/app/main.go

# Финальный легковесный образ
FROM alpine:latest
# Устанавливаем yt-dlp и ffmpeg (обязательно для музыки)
RUN apk add --no-cache ca-certificates yt-dlp ffmpeg python3
WORKDIR /root/
# Копируем бинарник и миграции из сборщика
COPY --from=builder /app/main .
COPY --from=builder /app/migrations ./migrations

EXPOSE 8080
CMD ["./main"]