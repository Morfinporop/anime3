import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : false,
  max: 10,
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 60000,
  statement_timeout: 60000,
});

export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}

export async function checkHealth(): Promise<boolean> {
  try { await pool.query('SELECT 1'); return true; } catch { return false; }
}

export async function initDB() {
  await query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(32) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_color VARCHAR(16) NOT NULL DEFAULT '#6366f1',
    avatar_data TEXT,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    can_upload BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
  )`);

  await query(`CREATE TABLE IF NOT EXISTS anime (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    poster_data BYTEA,
    poster_mime VARCHAR(50),
    video_data BYTEA,
    video_mime VARCHAR(50),
    hls_segments TEXT,
    genres TEXT[] NOT NULL DEFAULT '{}',
    year INT NOT NULL DEFAULT 2024,
    studio VARCHAR(100) NOT NULL DEFAULT '',
    views_count INT NOT NULL DEFAULT 0,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`);

  await query(`CREATE TABLE IF NOT EXISTS ratings (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    anime_id INT NOT NULL REFERENCES anime(id) ON DELETE CASCADE,
    score SMALLINT NOT NULL CHECK (score >= 1 AND score <= 10),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, anime_id)
  )`);

  await query(`CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    anime_id INT REFERENCES anime(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id INT REFERENCES comments(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`);

  await query(`CREATE TABLE IF NOT EXISTS comment_likes (
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment_id INT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, comment_id)
  )`);

  await query(`CREATE INDEX IF NOT EXISTS idx_comments_anime ON comments(anime_id, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_ratings_anime ON ratings(anime_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_anime_created ON anime(created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_anime_pinned ON anime(pinned DESC, created_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_comment_likes_c ON comment_likes(comment_id)`);

  // Add missing columns for existing DBs
  try { await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_data TEXT`); } catch {}
  try { await query(`ALTER TABLE anime ADD COLUMN IF NOT EXISTS hls_segments TEXT`); } catch {}
  try { await query(`ALTER TABLE anime ADD COLUMN IF NOT EXISTS studio VARCHAR(100) NOT NULL DEFAULT ''`); } catch {}
  try { await query(`ALTER TABLE anime ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE`); } catch {}

}

export default pool;
