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

.PHONY: help dev dev-logs init release stop logs clean db-shell migrate-up migrate-down build-front \
        infra run-back run-front dev-local

# Помощь
help:
	@echo "Доступные команды:"
	@echo "  make infra          - Запуск только базы и редиса (Docker)"
	@echo "  make dev-local      - Запуск бэка и фронта локально (одновременно)"
	@echo "  make run-back       - Запуск Go бэкенда локально"
	@echo "  make run-front      - Запуск React фронтенда локально"
	@echo "  make dev            - Запуск ВСЕГО в Docker (с Hot Reload)"
	@echo "  make init           - Первая настройка (инфра + deps + миграции)"

# --- ЛОКАЛЬНАЯ РАЗРАБОТКА (БЕЗ DOCKER) ---

# Запустить только инфраструктуру (база + редис + мониторинг)
infra:
	$(COMPOSE_BIN) up -d db redis asynqmon

# Запуск бэкенда (локально)
run-back:
	go run cmd/app/main.go

# Запуск фронтенда (локально)
run-front:
	cd $(FRONT_DIR) && npm run dev

# Запуск бэка и фронта в одном окне (локально)
dev-local:
	make -j 2 run-back run-front

# --- ЛОКАЛЬНАЯ РАЗРАБОТКА В DOCKER ---

dev:
	$(COMPOSE_BIN) up --build

dev-logs:
	$(COMPOSE_BIN) logs -f backend frontend

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

release:
	$(COMPOSE_BIN) up -d --build

stop:
	$(COMPOSE_BIN) down

db-shell:
	$(DOCKER_BIN) exec -it music_db psql -U postgres -d tg_music