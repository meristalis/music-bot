-- Отключаем проверку внешних ключей на время удаления (опционально, но безопасно)
SET session_replication_role = 'replica';

-- 1. Удаляем индексы (хотя они удалятся вместе с таблицами, лучше прописать явно)
DROP INDEX IF EXISTS idx_user_tracks_user_id;
DROP INDEX IF EXISTS idx_user_tracks_track_id;
DROP INDEX IF EXISTS idx_tracks_youtube_id;
DROP INDEX IF EXISTS idx_tracks_deezer_id;

-- 2. Удаляем связующую таблицу (Many-to-Many)
-- Важно удалить её первой, так как она ссылается на tracks и users
DROP TABLE IF EXISTS user_tracks;

-- 3. Удаляем основную таблицу треков
DROP TABLE IF EXISTS tracks;

-- Возвращаем проверку ключей
SET session_replication_role = 'origin';