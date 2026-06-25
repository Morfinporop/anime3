-- AnimeWorld Database Schema
-- Автоматически создается при запуске сервера

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(32) UNIQUE NOT NULL,
  password_hash VARCHAR(120) NOT NULL,
  avatar_color VARCHAR(16) NOT NULL DEFAULT '#6366f1',
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  can_upload BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS anime (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  poster_data BYTEA,
  poster_mime VARCHAR(50),
  video_data BYTEA,
  video_mime VARCHAR(50),
  genres TEXT[] NOT NULL DEFAULT '{}',
  year INT NOT NULL DEFAULT 2024,
  views_count INT NOT NULL DEFAULT 0,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ratings (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  anime_id INT REFERENCES anime(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL CHECK (score >= 1 AND score <= 10),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, anime_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  anime_id INT REFERENCES anime(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  parent_id INT REFERENCES comments(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comment_likes (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  comment_id INT REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, comment_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_comments_anime ON comments(anime_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ratings_anime ON ratings(anime_id);
CREATE INDEX IF NOT EXISTS idx_anime_created ON anime(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id);

-- Notes:
-- 1. Пользователь 'Morfin' автоматически получает isAdmin=true при регистрации
-- 2. Постеры и видео хранятся в БД как BYTEA (base64 encoded)
-- 3. Для Railway: задать переменную DATABASE_URL в настройках
