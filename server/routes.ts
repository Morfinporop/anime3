import { Router } from 'express';
import { query, checkHealth } from './db.ts';
import {
  hashPassword, verifyPassword, signToken, verifyToken, getRandomAvatarColor,
  requireAuth, requireAdmin, requireUploadPermission, optionalAuth,
  type UserPayload,
} from './auth.ts';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

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
       RETURNING id, username, avatar_color, avatar_data, is_admin, can_upload`,
      [username, hash, avatarColor, isAdmin, canUpload]
    );
    const user = r.rows[0];
    const payload: UserPayload = {
      id: user.id,
      username: user.username,
      avatarColor: user.avatar_color,
      avatarData: user.avatar_data || null,
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
      `SELECT id, username, password_hash, avatar_color, avatar_data, is_admin, can_upload FROM users WHERE username = $1`,
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
      avatarData: user.avatar_data || null,
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

router.get('/auth/me', async (req, res) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
    const decoded = verifyToken(token);
    if (!decoded) return res.status(401).json({ error: 'Недействительный токен' });

    const r = await query(`SELECT id, username, avatar_color, avatar_data, is_admin, can_upload FROM users WHERE id = $1`, [decoded.id]);
    const u = r.rows[0];
    if (!u) return res.status(401).json({ error: 'Пользователь не найден' });

    const payload: UserPayload = {
      id: u.id, username: u.username, avatarColor: u.avatar_color,
      avatarData: u.avatar_data || null, isAdmin: u.is_admin, canUpload: u.can_upload,
    };
    res.json({ user: payload });
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
      // Check uniqueness
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
    const payload: UserPayload = {
      id: u.id, username: u.username, avatarColor: u.avatar_color,
      avatarData: u.avatar_data || null, isAdmin: u.is_admin, canUpload: u.can_upload,
    };
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
             CASE WHEN a.video_data IS NOT NULL THEN true ELSE false END as has_video,
             CASE WHEN a.hls_segments IS NOT NULL THEN true ELSE false END as has_hls
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
      studio: r.studio || '',
      pinned: r.pinned || false,
      image: r.has_poster ? `/api/files/anime/${r.id}/poster` : '',
      videoSrc: r.has_hls ? `/api/files/anime/${r.id}/hls/master.m3u8` : (r.has_video ? `/api/files/anime/${r.id}/video` : ''),
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
      studio: r.studio || '',
      image: r.poster_data ? `/api/files/anime/${r.id}/poster` : '',
      videoSrc: r.hls_segments ? `/api/files/anime/${r.id}/hls/master.m3u8` : (r.video_data ? `/api/files/anime/${r.id}/video` : ''),
    });
  } catch (err: any) {
    console.error('[anime detail]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// SSE helper
function sseEvent(res: any, event: string, data: any) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

router.post('/anime', requireAuth, requireUploadPermission, async (req, res) => {
  // SSE streaming response for progress
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Credentials': 'true',
  });

  try {
    const { title, description, year, genres, studio, poster, video } = req.body;
    if (!title) { sseEvent(res, 'error', { error: 'Название обязательно' }); res.end(); return; }
    if (!video?.data) { sseEvent(res, 'error', { error: 'Видео обязательно' }); res.end(); return; }

    sseEvent(res, 'progress', { stage: 'decode', percent: 5, text: 'Декодирование видео...' });

    const genresArray = genres 
      ? String(genres).split(',').map((g: string) => g.trim()).filter(Boolean)
      : [];

    // Decode poster from base64
    let posterData: Buffer | null = null, posterMime: string | null = null;
    if (poster?.data && poster?.mime) {
      posterData = Buffer.from(poster.data, 'base64');
      posterMime = poster.mime;
      sseEvent(res, 'progress', { stage: 'poster', percent: 10, text: 'Постер обработан' });
    }

    // Decode video from base64 -> temp file
    sseEvent(res, 'progress', { stage: 'decode', percent: 15, text: 'Распаковка видео...' });
    const videoBuffer = Buffer.from(video.data, 'base64');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-'));
    const inputPath = path.join(tmpDir, 'input' + (video.mime === 'video/mp4' ? '.mp4' : '.mkv'));
    fs.writeFileSync(inputPath, videoBuffer);

    sseEvent(res, 'progress', { stage: 'decode', percent: 30, text: 'Видео распаковано, размер: ' + (videoBuffer.length / 1024 / 1024).toFixed(1) + ' МБ' });

    // Compress with ffmpeg: create HLS output with multiple qualities
    const outputDir = path.join(tmpDir, 'hls');
    fs.mkdirSync(outputDir);

    sseEvent(res, 'progress', { stage: 'compress', percent: 35, text: 'Запуск компрессии FFmpeg...' });

    // Build ffmpeg command for 2 quality levels (1080p + 144p) to HLS
    const masterPath = path.join(outputDir, 'master.m3u8');
    const args = [
      '-y',
      '-i', inputPath,
      '-preset', 'ultrafast',
      '-crf', '28',
      '-max_muxing_queue_size', '1024',
      '-map', '0:v', '-map', '0:a',
      '-s:v:0', '1920x1080', '-b:v:0', '2000k',
      '-map', '0:v', '-map', '0:a',
      '-s:v:1', '256x144', '-b:v:1', '150k',
      '-f', 'hls',
      '-hls_time', '6',
      '-hls_playlist_type', 'vod',
      '-hls_segment_filename', path.join(outputDir, 'q%d_%03d.ts'),
      '-var_stream_map', 'v:0,a:0 v:1,a:1',
      path.join(outputDir, 'q%d.m3u8'),
    ];

    // Spawn ffmpeg
    const ffmpeg = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let lastPercent = 35;

    ffmpeg.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      // Parse ffmpeg time progress
      const timeMatch = text.match(/time=(\d+):(\d+):(\d+\.\d+)/);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const seconds = parseFloat(timeMatch[3]);
        const totalSec = hours * 3600 + minutes * 60 + seconds;
        // Estimate progress based on video duration (roughly 3s per second of video = 33% of ffmpeg phase)
        const newPercent = 35 + Math.min(55, Math.round(totalSec * 2));
        if (newPercent > lastPercent) {
          lastPercent = newPercent;
          sseEvent(res, 'progress', { stage: 'compress', percent: Math.min(90, lastPercent), text: 'Компрессия: ' + formatFFTime(hours, minutes, Math.floor(seconds)) });
        }
      }
    });

    await new Promise<void>((resolve, reject) => {
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error('FFmpeg exit code: ' + code));
      });
      ffmpeg.on('error', reject);
    });

    sseEvent(res, 'progress', { stage: 'compress', percent: 90, text: 'Компрессия завершена, сохранение в БД...' });

    // Read master playlist + all ts segments + sub-playlists
    const files = fs.readdirSync(outputDir);
    const dbFiles: { name: string; data: Buffer; mime: string }[] = [];
    for (const f of files) {
      dbFiles.push({
        name: f,
        data: fs.readFileSync(path.join(outputDir, f)),
        mime: f.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t',
      });
    }

    sseEvent(res, 'progress', { stage: 'save', percent: 93, text: 'Сохранение в базу данных...' });

    // Store everything: poster, master playlist, segments
    const segmentsJson = dbFiles.map(f => ({ name: f.name, data: f.data.toString('base64'), mime: f.mime }));

    const { rows } = await query(
      `INSERT INTO anime (title, description, year, genres, studio, poster_data, poster_mime, hls_segments, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [title, description || '', Number(year) || new Date().getFullYear(), genresArray, (studio || '').trim(), posterData, posterMime, JSON.stringify(segmentsJson), req.user!.id]
    );

    // Cleanup temp
    try { fs.rmSync(tmpDir, { recursive: true }); } catch {}

    sseEvent(res, 'progress', { stage: 'done', percent: 100, text: 'Готово!' });
    sseEvent(res, 'complete', { id: rows[0].id });
    res.end();
  } catch (err: any) {
    console.error('[create anime]', err.message);
    sseEvent(res, 'error', { error: err.message || 'Ошибка сервера' });
    res.end();
  }
});

router.put('/anime/:id/pin', requireAuth, requireAdmin, async (req, res) => {
  try {
    const r = await query(`SELECT pinned FROM anime WHERE id = $1`, [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Не найдено' });
    const newVal = !r.rows[0].pinned;
    await query(`UPDATE anime SET pinned = $1 WHERE id = $2`, [newVal, req.params.id]);
    res.json({ pinned: newVal });
  } catch (err: any) {
    console.error('[pin anime]', err.message);
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
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(anime.poster_data);
  } catch (err: any) {
    console.error('[get poster]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// HLS: serve master.m3u8 or segment .ts
router.get('/files/anime/:id/hls/:file', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT hls_segments FROM anime WHERE id = $1`,
      [req.params.id]
    );
    const anime = rows[0];
    if (!anime?.hls_segments) {
      return res.status(404).json({ error: 'HLS данные не найдены' });
    }

    const segments = JSON.parse(anime.hls_segments);
    const file = segments.find((s: any) => s.name === req.params.file);
    if (!file) {
      return res.status(404).json({ error: 'Файл не найден' });
    }

    const buf = Buffer.from(file.data, 'base64');
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  } catch (err: any) {
    console.error('[get hls]', err.message);
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
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
      });
      res.end(videoBuffer.slice(start, end + 1));
    } else {
      res.writeHead(200, {
        'Content-Length': videoSize,
        'Content-Type': anime.video_mime || 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
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

function formatFFTime(h: number, m: number, s: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

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
