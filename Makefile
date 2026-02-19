# 1. Загрузка переменных
ifneq (,$(wildcard ./.env))
    include .env
    export
endif

# Константы
MIG_PATH=migrations
FRONT_DIR=frontend
DOCKER_BIN=docker
COMPOSE_BIN=docker compose

.PHONY: help dev init release stop logs clean db-shell migrate-up migrate-down migrate-create

# Помощь по умолчанию
help:
	@echo "Доступные команды:"
	@echo "  make dev            - Запуск локально (Windows: бэк и фронт в разных окнах)"
	@echo "  make init           - Первая настройка проекта локально"
	@echo "  make release        - [SERVER] Полная сборка и запуск в Docker (prod-mode)"
	@echo "  make stop           - [SERVER] Остановка всех контейнеров"
	@echo "  make logs           - Просмотр логов контейнеров"
	@echo "  make migrate-up     - Накатить миграции (локально)"
	@echo "  make db-shell       - Зайти в консоль Postgres внутри Docker"

# --- ЛОКАЛЬНАЯ РАЗРАБОТКА ---

# Инициализация проекта локально
init:
	@echo "Установка зависимостей..."
	go mod tidy
	cd $(FRONT_DIR) && npm install
	$(COMPOSE_BIN) up -d db redis asynqmon # Поднимаем только инфраструктуру

# Запуск всего сразу (Fullstack dev mode для Windows)
dev:
	start "Backend" cmd /c "go run cmd/app/main.go"
	start "Frontend" cmd /c "cd $(FRONT_DIR) && npm run dev"

# Миграции (локальные)
migrate-up:
	migrate -path $(MIG_PATH) -database "$(DB_URL)" up

migrate-down:
	migrate -path $(MIG_PATH) -database "$(DB_URL)" down 1

migrate-create:
	migrate create -ext sql -dir $(MIG_PATH) -seq $(name)


# --- СЕРВЕРНЫЙ ДЕПЛОЙ (DOCKER-WAY) ---

# Полный запуск на сервере (собирает фронт, бэк и поднимает прокси)
release:
	@echo "Запуск полной сборки на сервере..."
	$(COMPOSE_BIN) up -d --build

# Остановка продакшн-окружения
stop:
	$(COMPOSE_BIN) down

# Просмотр логов на сервере
logs:
	$(COMPOSE_BIN) logs -f

# Очистка старых образов (чтобы не забивать диск сервера)
clean:
	$(DOCKER_BIN) image prune -f


# --- УТИЛИТЫ ---

# Быстрый вход в базу данных
db-shell:
	$(DOCKER_BIN) exec -it music_db psql -U postgres -d tg_music

# Установка yt-dlp (если вдруг понадобится обновить на сервере вне докера)
ytdl-update:
	@echo "Обновление yt-dlp..."
	sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
	sudo chmod a+rx /usr/local/bin/yt-dlp