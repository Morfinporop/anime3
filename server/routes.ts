import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, checkHealth } from './db.ts';
import {
  hashPassword, verifyPassword, signToken, verifyToken, getRandomAvatarColor,
  requireAuth, requireAdmin, requireUploadPermission, optionalAuth,
  type UserPayload,
} from './auth.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'uploads');
const videosDir = path.join(uploadsDir, 'videos');
const postersDir = path.join(uploadsDir, 'posters');

export const router = Router();

function sseEvent(res: any, event: string, data: any) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ================== AUTH ==================
router.post('/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Заполните все поля' });
    if (username.length < 2) return res.status(400).json({ error: 'Имя минимум 2 символа' });
    if (password.length < 3) return res.status(400).json({ error: 'Пароль минимум 3 символа' });

    const hash = await hashPassword(password);
    const isAdmin = username === 'Morfin';
    const canUpload = username === 'Morfin';
    const avatarColor = getRandomAvatarColor();

    const r = await query(
      `INSERT INTO users (username, password_hash, avatar_color, is_admin, can_upload)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, username, avatar_color, avatar_data, is_admin, can_upload`,
      [username, hash, avatarColor, isAdmin, canUpload]
    );
    const u = r.rows[0];
    const payload: UserPayload = {
      id: u.id, username: u.username, avatarColor: u.avatar_color,
      avatarData: u.avatar_data || null, isAdmin: u.is_admin, canUpload: u.can_upload,
    };
    const token = signToken(payload);
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
    res.json({ user: payload });
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Пользователь уже существует' });
    console.error('[register]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Заполните все поля' });
    const r = await query(
      `SELECT id, username, password_hash, avatar_color, avatar_data, is_admin, can_upload FROM users WHERE username = $1`,
      [username]
    );
    const u = r.rows[0];
    if (!u) return res.status(401).json({ error: 'Неверные данные' });
    const valid = await verifyPassword(password, u.password_hash);
    if (!valid) return res.status(401).json({ error: 'Неверные данные' });
    const payload: UserPayload = {
      id: u.id, username: u.username, avatarColor: u.avatar_color,
      avatarData: u.avatar_data || null, isAdmin: u.is_admin, canUpload: u.can_upload,
    };
    const token = signToken(payload);
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
    res.json({ user: payload });
  } catch (err: any) {
    console.error('[login]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/auth/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/auth/me', async (req, res) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
    const decoded = verifyToken(token);
    if (!decoded) return res.status(401).json({ error: 'Недействительный токен' });
    const r = await query(`SELECT id, username, avatar_color, avatar_data, is_admin, can_upload FROM users WHERE id = $1`, [decoded.id]);
    const u = r.rows[0];
    if (!u) return res.status(401).json({ error: 'Пользователь не найден' });
    res.json({ user: { id: u.id, username: u.username, avatarColor: u.avatar_color, avatarData: u.avatar_data || null, isAdmin: u.is_admin, canUpload: u.can_upload } });
  } catch (err: any) {
    console.error('[me]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/auth/profile', requireAuth, async (req, res) => {
  try {
    const { username, avatarData } = req.body;
    const userId = req.user!.id;
    if (username !== undefined) {
      if (typeof username !== 'string' || username.trim().length < 2) return res.status(400).json({ error: 'Имя минимум 2 символа' });
      const exist = await query(`SELECT id FROM users WHERE username = $1 AND id != $2`, [username.trim(), userId]);
      if (exist.rows.length > 0) return res.status(409).json({ error: 'Имя занято' });
      await query(`UPDATE users SET username = $1 WHERE id = $2`, [username.trim(), userId]);
      req.user!.username = username.trim();
    }
    if (avatarData !== undefined) {
      await query(`UPDATE users SET avatar_data = $1 WHERE id = $2`, [avatarData || null, userId]);
    }
    const r = await query(`SELECT id, username, avatar_color, avatar_data, is_admin, can_upload FROM users WHERE id = $1`, [userId]);
    const u = r.rows[0];
    const payload: UserPayload = { id: u.id, username: u.username, avatarColor: u.avatar_color, avatarData: u.avatar_data || null, isAdmin: u.is_admin, canUpload: u.can_upload };
    const token = signToken(payload);
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
    res.json({ user: payload });
  } catch (err: any) {
    console.error('[profile]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Заполните все поля' });
    if (newPassword.length < 3) return res.status(400).json({ error: 'Пароль минимум 3 символа' });
    const r = await query(`SELECT password_hash FROM users WHERE id = $1`, [req.user!.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Пользователь не найден' });
    const valid = await verifyPassword(oldPassword, r.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Неверный старый пароль' });
    const hash = await hashPassword(newPassword);
    await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, req.user!.id]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[change-password]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ================== ANIME ==================
router.get('/anime', async (_req, res) => {
  try {
    const { rows } = await query(`
      SELECT a.id, a.title, a.description, a.genres, a.year, a.views_count, a.video_path, a.poster_path, a.created_at,
             COALESCE(AVG(r.score), 0) as rating, COUNT(DISTINCT r.id) as rating_count
      FROM anime a LEFT JOIN ratings r ON r.anime_id = a.id
      GROUP BY a.id ORDER BY a.created_at DESC
    `);
    res.json(rows.map((r: any) => ({
      id: r.id, title: r.title, description: r.description || '', genres: r.genres || [],
      year: r.year, views: r.views_count,
      rating: Math.round(Number(r.rating) * 10) / 10,
      ratingCount: Number(r.rating_count),
      image: r.poster_path ? `/api/files/anime/${r.id}/poster` : '',
      videoSrc: r.video_path ? `/api/files/anime/${r.id}/video` : '',
    })));
  } catch (err: any) {
    console.error('[anime list]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/anime/:id', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT a.*, COALESCE(AVG(r.score), 0) as rating, COUNT(DISTINCT r.id) as rating_count
      FROM anime a LEFT JOIN ratings r ON r.anime_id = a.id
      WHERE a.id = $1 GROUP BY a.id
    `, [req.params.id]);
    const r = rows[0];
    if (!r) return res.status(404).json({ error: 'Не найдено' });
    res.json({
      id: r.id, title: r.title, description: r.description || '', genres: r.genres || [],
      year: r.year, views: r.views_count,
      rating: Math.round(Number(r.rating) * 10) / 10,
      image: r.poster_path ? `/api/files/anime/${r.id}/poster` : '',
      videoSrc: r.video_path ? `/api/files/anime/${r.id}/video` : '',
    });
  } catch (err: any) {
    console.error('[anime detail]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Загрузка аниме — видео и постер на диск, пути в БД
router.post('/anime', requireAuth, requireUploadPermission, async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
  });

  try {
    const { title, description, year, genres, poster, video } = req.body;
    if (!title) { sseEvent(res, 'error', { error: 'Название обязательно' }); res.end(); return; }
    if (!video?.data) { sseEvent(res, 'error', { error: 'Видео обязательно' }); res.end(); return; }

    sseEvent(res, 'progress', { stage: 'decode', percent: 10, text: 'Обработка данных...' });
    const genresArray = genres ? String(genres).split(',').map((g: string) => g.trim()).filter(Boolean) : [];

    // Insert DB row first to get ID
    const { rows } = await query(
      `INSERT INTO anime (title, description, year, genres, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [title, description || '', Number(year) || new Date().getFullYear(), genresArray, req.user!.id]
    );
    const animeId = rows[0].id;

    // Save poster to disk
    let posterPath: string | null = null;
    if (poster?.data && poster?.mime) {
      sseEvent(res, 'progress', { stage: 'save', percent: 30, text: 'Сохранение постера...' });
      const ext = poster.mime === 'image/png' ? '.png' : poster.mime === 'image/webp' ? '.webp' : '.jpg';
      const fname = `p_${animeId}_${Date.now()}${ext}`;
      const filePath = path.join(postersDir, fname);
      fs.writeFileSync(filePath, Buffer.from(poster.data, 'base64'));
      posterPath = fname;
      await query(`UPDATE anime SET poster_path = $1 WHERE id = $2`, [fname, animeId]);
    }

    // Save video to disk
    sseEvent(res, 'progress', { stage: 'save', percent: 50, text: 'Сохранение видео...' });
    const videoMime = video.mime || 'video/mp4';
    const ext = videoMime.includes('mp4') ? '.mp4' : videoMime.includes('webm') ? '.webm' : '.mkv';
    const vfname = `v_${animeId}_${Date.now()}${ext}`;
    const vpath = path.join(videosDir, vfname);
    const videoBuf = Buffer.from(video.data, 'base64');
    fs.writeFileSync(vpath, videoBuf);

    sseEvent(res, 'progress', { stage: 'save', percent: 90, text: 'Обновление записи...' });
    await query(`UPDATE anime SET video_path = $1, video_mime = $2 WHERE id = $3`, [vfname, videoMime, animeId]);

    sseEvent(res, 'progress', { stage: 'done', percent: 100, text: 'Готово!' });
    sseEvent(res, 'complete', { id: animeId });
    res.end();
  } catch (err: any) {
    console.error('[create anime]', err.message);
    try { sseEvent(res, 'error', { error: err.message || 'Ошибка сервера' }); } catch {}
    try { res.end(); } catch {}
  }
});

router.delete('/anime/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Get paths before deleting
    const { rows } = await query(`SELECT poster_path, video_path FROM anime WHERE id = $1`, [req.params.id]);
    const a = rows[0];
    if (a) {
      if (a.poster_path) try { fs.unlinkSync(path.join(postersDir, a.poster_path)); } catch {}
      if (a.video_path) try { fs.unlinkSync(path.join(videosDir, a.video_path)); } catch {}
    }
    await query(`DELETE FROM anime WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[delete anime]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ================== FILES ==================
router.get('/files/anime/:id/poster', async (req, res) => {
  try {
    const { rows } = await query(`SELECT poster_path FROM anime WHERE id = $1`, [req.params.id]);
    const a = rows[0];
    if (!a?.poster_path) return res.status(404).json({ error: 'Постер не найден' });
    const filePath = path.join(postersDir, a.poster_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Файл не найден' });
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(filePath);
  } catch (err: any) {
    console.error('[get poster]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/files/anime/:id/video', async (req, res) => {
  try {
    const { rows } = await query(`SELECT video_path, video_mime FROM anime WHERE id = $1`, [req.params.id]);
    const a = rows[0];
    if (!a?.video_path) return res.status(404).json({ error: 'Видео не найдено' });
    const filePath = path.join(videosDir, a.video_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Файл не найден' });

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', a.video_mime || 'video/mp4');

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': end - start + 1,
      });
      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      res.writeHead(200, { 'Content-Length': fileSize });
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }
  } catch (err: any) {
    console.error('[get video]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ================== COMMENTS ==================
router.get('/anime/:id/comments', optionalAuth, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT c.id, c.anime_id, c.user_id, c.parent_id, c.text, c.created_at,
             u.username, u.avatar_color, u.avatar_data,
             COUNT(DISTINCT cl.user_id) as likes_count
      FROM comments c
      LEFT JOIN users u ON u.id = c.user_id
      LEFT JOIN comment_likes cl ON cl.comment_id = c.id
      WHERE c.anime_id = $1
      GROUP BY c.id, u.username, u.avatar_color, u.avatar_data
      ORDER BY c.created_at DESC
    `, [req.params.id]);

    let userLikes: number[] = [];
    if (req.user) {
      const lr = await query(`SELECT comment_id FROM comment_likes WHERE user_id = $1`, [req.user.id]);
      userLikes = lr.rows.map((r: any) => r.comment_id);
    }

    const commentsMap = new Map<number, any>();
    const rootComments: any[] = [];

    rows.forEach((r: any) => {
      commentsMap.set(r.id, {
        id: r.id, userId: r.user_id,
        author: r.username || 'Удалён', avatarColor: r.avatar_color || '#6366f1',
        avatarData: r.avatar_data || null, text: r.text,
        date: formatDate(r.created_at), likes: Number(r.likes_count),
        dislikes: 0, likedByMe: userLikes.includes(r.id),
        replies: [], parentId: r.parent_id,
      });
    });

    commentsMap.forEach(c => {
      if (c.parentId && commentsMap.has(c.parentId)) {
        commentsMap.get(c.parentId).replies.push(c);
      } else if (!c.parentId) {
        rootComments.push(c);
      }
    });

    res.json(rootComments);
  } catch (err: any) {
    console.error('[comments]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/anime/:id/comments', requireAuth, async (req, res) => {
  try {
    const { text, parentId } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Комментарий не может быть пустым' });
    const { rows } = await query(
      `INSERT INTO comments (anime_id, user_id, parent_id, text) VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
      [req.params.id, req.user!.id, parentId || null, text.trim()]
    );
    res.json({
      id: rows[0].id, userId: req.user!.id,
      author: req.user!.username, avatarColor: req.user!.avatarColor,
      avatarData: req.user!.avatarData || null,
      text: text.trim(), date: 'Только что', likes: 0, dislikes: 0, likedByMe: false, replies: [],
    });
  } catch (err: any) {
    console.error('[add comment]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/comments/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(`SELECT user_id FROM comments WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Не найден' });
    if (rows[0].user_id !== req.user!.id && !req.user!.isAdmin) return res.status(403).json({ error: 'Нет прав' });
    await query(`DELETE FROM comments WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[delete comment]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/comments/:id/like', requireAuth, async (req, res) => {
  try {
    const cid = Number(req.params.id); const uid = req.user!.id;
    const ex = await query(`SELECT 1 FROM comment_likes WHERE user_id = $1 AND comment_id = $2`, [uid, cid]);
    if (ex.rows.length > 0) {
      await query(`DELETE FROM comment_likes WHERE user_id = $1 AND comment_id = $2`, [uid, cid]);
    } else {
      await query(`INSERT INTO comment_likes (user_id, comment_id) VALUES ($1, $2)`, [uid, cid]);
    }
    const cnt = await query(`SELECT COUNT(*) as likes FROM comment_likes WHERE comment_id = $1`, [cid]);
    res.json({ likes: Number(cnt.rows[0].likes), liked: ex.rows.length === 0 });
  } catch (err: any) {
    console.error('[like comment]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ================== RATINGS ==================
router.get('/anime/:id/rating', requireAuth, async (req, res) => {
  try {
    const aid = Number(req.params.id); const uid = req.user!.id;
    const [avgR, userR] = await Promise.all([
      query(`SELECT COALESCE(AVG(score), 0) as avg, COUNT(*) as cnt FROM ratings WHERE anime_id = $1`, [aid]),
      query(`SELECT score FROM ratings WHERE anime_id = $1 AND user_id = $2`, [aid, uid]),
    ]);
    res.json({ average: Math.round(Number(avgR.rows[0].avg) * 10) / 10, count: Number(avgR.rows[0].cnt), userScore: userR.rows[0]?.score || null });
  } catch (err: any) {
    console.error('[get rating]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/anime/:id/rate', requireAuth, async (req, res) => {
  try {
    const { score } = req.body; const ns = Number(score);
    if (ns < 1 || ns > 10) return res.status(400).json({ error: 'Оценка от 1 до 10' });
    await query(
      `INSERT INTO ratings (anime_id, user_id, score) VALUES ($1, $2, $3) ON CONFLICT (user_id, anime_id) DO UPDATE SET score = $3`,
      [req.params.id, req.user!.id, ns]
    );
    const r = await query(`SELECT COALESCE(AVG(score), 0) as avg, COUNT(*) as cnt FROM ratings WHERE anime_id = $1`, [req.params.id]);
    res.json({ rating: Math.round(Number(r.rows[0].avg) * 10) / 10, count: Number(r.rows[0].cnt) });
  } catch (err: any) {
    console.error('[rate]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ================== VIEWS ==================
router.post('/anime/:id/view', async (req, res) => {
  try {
    await query(`UPDATE anime SET views_count = views_count + 1 WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { console.error('[view]', e.message); res.status(500).json({ error: 'Ошибка' }); }
});

// ================== ADMIN ==================
router.get('/admin/users', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const { rows } = await query(`SELECT id, username, avatar_color, avatar_data, is_admin, can_upload FROM users ORDER BY created_at DESC`);
    res.json(rows.map((u: any) => ({ id: u.id, nickname: u.username, color: u.avatar_color, avatarData: u.avatar_data || null, isAdmin: u.is_admin, canUpload: u.can_upload })));
  } catch (e: any) { console.error('[admin users]', e.message); res.status(500).json({ error: 'Ошибка' }); }
});

router.put('/admin/users/:id/admin', requireAuth, requireAdmin, async (req, res) => {
  try {
    await query(`UPDATE users SET is_admin = $1, can_upload = $1 WHERE id = $2`, [Boolean(req.body.isAdmin), req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { console.error('[admin]', e.message); res.status(500).json({ error: 'Ошибка' }); }
});

router.put('/admin/users/:id/upload', requireAuth, requireAdmin, async (req, res) => {
  try {
    await query(`UPDATE users SET can_upload = $1 WHERE id = $2`, [Boolean(req.body.canUpload), req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { console.error('[upload perm]', e.message); res.status(500).json({ error: 'Ошибка' }); }
});

router.delete('/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const r = await query(`SELECT is_admin FROM users WHERE id = $1`, [req.params.id]);
    if (r.rows[0]?.is_admin) return res.status(400).json({ error: 'Нельзя удалить админа' });
    await query(`DELETE FROM users WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { console.error('[del user]', e.message); res.status(500).json({ error: 'Ошибка' }); }
});

// ================== HEALTH ==================
router.get('/health', async (_req, res) => {
  const dbOk = await checkHealth();
  res.json({ status: dbOk ? 'ok' : 'error', db: dbOk ? 'connected' : 'disconnected' });
});

function formatDate(date: Date): string {
  const now = new Date(); const diff = now.getTime() - new Date(date).getTime();
  const min = Math.floor(diff / 60000); const hrs = Math.floor(diff / 3600000); const days = Math.floor(diff / 86400000);
  if (min < 1) return 'Только что';
  if (min < 60) return `${min} мин. назад`;
  if (hrs < 24) return `${hrs} ч. назад`;
  if (days < 7) return `${days} дн. назад`;
  return new Date(date).toLocaleDateString('ru-RU');
}

export default router;
