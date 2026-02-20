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
# Файлы конфигурации
COMPOSE_DEV=$(COMPOSE_BIN)
COMPOSE_PROD=$(COMPOSE_BIN) -f docker-compose.yaml

.PHONY: help dev dev-logs init stop logs clean db-shell migrate-up migrate-down build-front \
        infra run-back run-front dev-local prod-up prod-down prod-logs prod-deploy

# Помощь
help:
	@echo "Доступные команды:"
	@echo "  make infra          - Запуск только базы и редиса (Docker)"
	@echo "  make dev            - Запуск ВСЕГО в Docker (с Hot Reload + Override)"
	@echo "  make prod-deploy    - Полный цикл деплоя на сервере (Build + Up)"
	@echo "  make prod-up        - Запуск на сервере (игнорируя override)"
	@echo "  make stop           - Остановить все"

# --- ЛОКАЛЬНАЯ РАЗРАБОТКА (БЕЗ DOCKER) ---

infra:
	$(COMPOSE_BIN) up -d db redis asynqmon

run-back:
	go run cmd/app/main.go

run-front:
	cd $(FRONT_DIR) && npm run dev

dev-local:
	make -j 2 run-back run-front

# --- ЛОКАЛЬНАЯ РАЗРАБОТКА В DOCKER (С OVERRIDE) ---

dev:
	$(COMPOSE_DEV) up --build

dev-logs:
	$(COMPOSE_DEV) logs -f backend frontend

# --- ПРОДАКШЕН (PRODUCTION) ---
# Используем -f docker-compose.yml, чтобы игнорировать локальный override
build:
	$(COMPOSE_PROD) build --no-cache

prod-up:
	$(COMPOSE_PROD) up -d

prod-down:
	$(COMPOSE_PROD) down

prod-logs:
	$(COMPOSE_PROD) logs -f

prod-deploy:
	$(COMPOSE_PROD) up -d --build --no-cache --remove-orphans
	@echo "Деплой завершен!"

# --- ОБЩИЕ КОМАНДЫ ---

init:
	@echo "Установка зависимостей..."
	go mod tidy
	cd $(FRONT_DIR) && npm install
	@echo "Запуск инфраструктуры..."
	make infra
	@echo "Ожидание БД..."
	sleep 3
	make migrate-up
	@echo "Готово!"

migrate-up:
	migrate -path $(MIG_PATH) -database "$(DB_URL)" up

migrate-down:
	migrate -path $(MIG_PATH) -database "$(DB_URL)" down 1

stop:
	$(COMPOSE_BIN) down

db-shell:
	$(DOCKER_BIN) exec -it music_db psql -U postgres -d tg_music