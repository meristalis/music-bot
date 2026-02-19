CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tracks (
    id SERIAL PRIMARY KEY,
    -- ID из внешних сервисов (могут быть NULL, если это ручная загрузка)
    deezer_id BIGINT UNIQUE,      
    youtube_id TEXT,      
    
    -- Метаданные (всегда заполняем)
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    duration INTEGER,
    cover_url TEXT,
    
    -- Telegram данные (связующее звено)
    file_id TEXT,                 -- Для отправки файла
    file_unique_id TEXT,   -- Глобальный уникальный ключ Telegram
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'idle'
);

CREATE TABLE IF NOT EXISTS user_tracks (
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, track_id)
);