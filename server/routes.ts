import { Router } from 'express';
import { query, checkHealth } from './db.ts';
import {
  hashPassword, verifyPassword, signToken, getRandomAvatarColor,
  requireAuth, requireAdmin, requireUploadPermission, optionalAuth,
  type UserPayload,
} from './auth.ts';

export const router = Router();

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
       RETURNING id, username, avatar_color, is_admin, can_upload`,
      [username, hash, avatarColor, isAdmin, canUpload]
    );
    const user = r.rows[0];
    const payload: UserPayload = {
      id: user.id,
      username: user.username,
      avatarColor: user.avatar_color,
      isAdmin: user.is_admin,
      canUpload: user.can_upload,
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
      `SELECT id, username, password_hash, avatar_color, is_admin, can_upload FROM users WHERE username = $1`,
      [username]
    );
    const user = r.rows[0];
    if (!user) return res.status(401).json({ error: 'Неверные данные' });
    
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Неверные данные' });

    const payload: UserPayload = {
      id: user.id,
      username: user.username,
      avatarColor: user.avatar_color,
      isAdmin: user.is_admin,
      canUpload: user.can_upload,
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

router.get('/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Заполните все поля' });
    if (newPassword.length < 3) return res.status(400).json({ error: 'Пароль минимум 3 символа' });

    const r = await query(`SELECT password_hash FROM users WHERE id = $1`, [req.user!.id]);
    const user = r.rows[0];
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const valid = await verifyPassword(oldPassword, user.password_hash);
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
      SELECT a.id, a.title, a.description, a.genres, a.year, a.views_count, a.created_at,
             COALESCE(AVG(r.score), 0) as rating,
             COUNT(DISTINCT r.id) as rating_count,
             CASE WHEN a.poster_data IS NOT NULL THEN true ELSE false END as has_poster,
             CASE WHEN a.video_data IS NOT NULL THEN true ELSE false END as has_video
      FROM anime a
      LEFT JOIN ratings r ON r.anime_id = a.id
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `);
    
    const items = rows.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description || '',
      genres: r.genres || [],
      year: r.year,
      views: r.views_count,
      rating: Math.round(Number(r.rating) * 10) / 10,
      ratingCount: Number(r.rating_count),
      image: r.has_poster ? `/api/files/anime/${r.id}/poster` : '',
      videoSrc: r.has_video ? `/api/files/anime/${r.id}/video` : '',
      createdAt: r.created_at,
    }));
    res.json(items);
  } catch (err: any) {
    console.error('[anime list]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/anime/:id', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT a.*, 
             COALESCE(AVG(r.score), 0) as rating,
             COUNT(DISTINCT r.id) as rating_count
      FROM anime a
      LEFT JOIN ratings r ON r.anime_id = a.id
      WHERE a.id = $1
      GROUP BY a.id
    `, [req.params.id]);
    
    const r = rows[0];
    if (!r) return res.status(404).json({ error: 'Не найдено' });

    res.json({
      id: r.id,
      title: r.title,
      description: r.description || '',
      genres: r.genres || [],
      year: r.year,
      views: r.views_count,
      rating: Math.round(Number(r.rating) * 10) / 10,
      image: r.poster_data ? `/api/files/anime/${r.id}/poster` : '',
      videoSrc: r.video_data ? `/api/files/anime/${r.id}/video` : '',
    });
  } catch (err: any) {
    console.error('[anime detail]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/anime', requireAuth, requireUploadPermission, async (req, res) => {
  try {
    const { title, description, year, genres, poster, video } = req.body;
    if (!title) return res.status(400).json({ error: 'Название обязательно' });

    const genresArray = genres 
      ? String(genres).split(',').map((g: string) => g.trim()).filter(Boolean)
      : [];

    let posterData = null, posterMime = null;
    if (poster?.data && poster?.mime) {
      posterData = Buffer.from(poster.data, 'base64');
      posterMime = poster.mime;
    }

    let videoData = null, videoMime = null;
    if (video?.data && video?.mime) {
      videoData = Buffer.from(video.data, 'base64');
      videoMime = video.mime;
    }

    const { rows } = await query(
      `INSERT INTO anime (title, description, year, genres, poster_data, poster_mime, video_data, video_mime, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [title, description || '', Number(year) || new Date().getFullYear(), genresArray, posterData, posterMime, videoData, videoMime, req.user!.id]
    );

    res.json({ id: rows[0].id });
  } catch (err: any) {
    console.error('[create anime]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/anime/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
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
    const { rows } = await query(
      `SELECT poster_data, poster_mime FROM anime WHERE id = $1`,
      [req.params.id]
    );
    const anime = rows[0];
    if (!anime?.poster_data) {
      return res.status(404).json({ error: 'Постер не найден' });
    }
    res.setHeader('Content-Type', anime.poster_mime || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(anime.poster_data);
  } catch (err: any) {
    console.error('[get poster]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/files/anime/:id/video', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT video_data, video_mime FROM anime WHERE id = $1`,
      [req.params.id]
    );
    const anime = rows[0];
    if (!anime?.video_data) {
      return res.status(404).json({ error: 'Видео не найдено' });
    }
    
    const videoBuffer = anime.video_data;
    const videoSize = videoBuffer.length;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : videoSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${videoSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': anime.video_mime || 'video/mp4',
      });
      res.end(videoBuffer.slice(start, end + 1));
    } else {
      res.writeHead(200, {
        'Content-Length': videoSize,
        'Content-Type': anime.video_mime || 'video/mp4',
        'Accept-Ranges': 'bytes',
      });
      res.end(videoBuffer);
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
             u.username, u.avatar_color,
             COUNT(DISTINCT cl.user_id) as likes_count
      FROM comments c
      LEFT JOIN users u ON u.id = c.user_id
      LEFT JOIN comment_likes cl ON cl.comment_id = c.id
      WHERE c.anime_id = $1
      GROUP BY c.id, u.username, u.avatar_color
      ORDER BY c.created_at DESC
    `, [req.params.id]);

    let userLikes: number[] = [];
    if (req.user) {
      const likesRes = await query(
        `SELECT comment_id FROM comment_likes WHERE user_id = $1`,
        [req.user.id]
      );
      userLikes = likesRes.rows.map(r => r.comment_id);
    }

    const commentsMap = new Map<number, any>();
    const rootComments: any[] = [];

    rows.forEach(r => {
      const comment = {
        id: r.id,
        author: r.username || 'Удалён',
        avatarColor: r.avatar_color || '#6366f1',
        avatar: '',
        text: r.text,
        date: formatDate(r.created_at),
        likes: Number(r.likes_count),
        dislikes: 0,
        likedByMe: userLikes.includes(r.id),
        replies: [],
        parentId: r.parent_id,
      };
      commentsMap.set(r.id, comment);
    });

    commentsMap.forEach(comment => {
      if (comment.parentId && commentsMap.has(comment.parentId)) {
        commentsMap.get(comment.parentId).replies.push(comment);
      } else if (!comment.parentId) {
        rootComments.push(comment);
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
      `INSERT INTO comments (anime_id, user_id, parent_id, text)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [req.params.id, req.user!.id, parentId || null, text.trim()]
    );

    res.json({
      id: rows[0].id,
      author: req.user!.username,
      avatarColor: req.user!.avatarColor,
      avatar: '',
      text: text.trim(),
      date: 'Только что',
      likes: 0,
      dislikes: 0,
      likedByMe: false,
      replies: [],
    });
  } catch (err: any) {
    console.error('[add comment]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/comments/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(`SELECT user_id FROM comments WHERE id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Комментарий не найден' });
    
    if (rows[0].user_id !== req.user!.id && !req.user!.isAdmin) {
      return res.status(403).json({ error: 'Нет прав' });
    }

    await query(`DELETE FROM comments WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[delete comment]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/comments/:id/like', requireAuth, async (req, res) => {
  try {
    const commentId = Number(req.params.id);
    const userId = req.user!.id;

    const existing = await query(
      `SELECT 1 FROM comment_likes WHERE user_id = $1 AND comment_id = $2`,
      [userId, commentId]
    );

    if (existing.rows.length > 0) {
      await query(
        `DELETE FROM comment_likes WHERE user_id = $1 AND comment_id = $2`,
        [userId, commentId]
      );
    } else {
      await query(
        `INSERT INTO comment_likes (user_id, comment_id) VALUES ($1, $2)`,
        [userId, commentId]
      );
    }

    const countRes = await query(
      `SELECT COUNT(*) as likes FROM comment_likes WHERE comment_id = $1`,
      [commentId]
    );

    res.json({ 
      likes: Number(countRes.rows[0].likes),
      liked: existing.rows.length === 0
    });
  } catch (err: any) {
    console.error('[like comment]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ================== RATINGS ==================
router.get('/anime/:id/rating', requireAuth, async (req, res) => {
  try {
    const animeId = Number(req.params.id);
    const userId = req.user!.id;

    const [avgRes, userRes] = await Promise.all([
      query(`SELECT COALESCE(AVG(score), 0) as avg, COUNT(*) as count FROM ratings WHERE anime_id = $1`, [animeId]),
      query(`SELECT score FROM ratings WHERE anime_id = $1 AND user_id = $2`, [animeId, userId]),
    ]);

    res.json({
      average: Math.round(Number(avgRes.rows[0].avg) * 10) / 10,
      count: Number(avgRes.rows[0].count),
      userScore: userRes.rows[0]?.score || null,
    });
  } catch (err: any) {
    console.error('[get rating]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/anime/:id/rate', requireAuth, async (req, res) => {
  try {
    const { score } = req.body;
    const numScore = Number(score);
    if (numScore < 1 || numScore > 10) return res.status(400).json({ error: 'Оценка от 1 до 10' });

    await query(
      `INSERT INTO ratings (anime_id, user_id, score)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, anime_id) DO UPDATE SET score = $3`,
      [req.params.id, req.user!.id, numScore]
    );

    const ratingRes = await query(
      `SELECT COALESCE(AVG(score), 0) as avg, COUNT(*) as count FROM ratings WHERE anime_id = $1`,
      [req.params.id]
    );

    res.json({
      rating: Math.round(Number(ratingRes.rows[0].avg) * 10) / 10,
      count: Number(ratingRes.rows[0].count),
    });
  } catch (err: any) {
    console.error('[rate]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ================== VIEWS ==================
router.post('/anime/:id/view', async (req, res) => {
  try {
    await query(
      `UPDATE anime SET views_count = views_count + 1 WHERE id = $1`,
      [req.params.id]
    );
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[view]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ================== ADMIN ==================
router.get('/admin/users', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, username, avatar_color, is_admin, can_upload, created_at 
       FROM users ORDER BY created_at DESC`
    );
    res.json(rows.map(u => ({
      id: u.id,
      nickname: u.username,
      color: u.avatar_color,
      isAdmin: u.is_admin,
      canUpload: u.can_upload,
    })));
  } catch (err: any) {
    console.error('[admin users]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/admin/users/:id/admin', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { isAdmin } = req.body;
    await query(`UPDATE users SET is_admin = $1, can_upload = $1 WHERE id = $2`, [Boolean(isAdmin), req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[set admin]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.put('/admin/users/:id/upload', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { canUpload } = req.body;
    await query(`UPDATE users SET can_upload = $1 WHERE id = $2`, [Boolean(canUpload), req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[set upload]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await query(`SELECT is_admin FROM users WHERE id = $1`, [req.params.id]);
    if (rows[0]?.is_admin) return res.status(400).json({ error: 'Нельзя удалить админа' });
    
    await query(`DELETE FROM users WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[delete user]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ================== HEALTH ==================
router.get('/health', async (_req, res) => {
  const dbOk = await checkHealth();
  if (dbOk) {
    res.json({ status: 'ok', db: 'connected' });
  } else {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Только что';
  if (minutes < 60) return `${minutes} мин. назад`;
  if (hours < 24) return `${hours} ч. назад`;
  if (days < 7) return `${days} дн. назад`;
  
  return new Date(date).toLocaleDateString('ru-RU');
}

export default router;
