import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDB } from './db.ts';
import { router } from './routes.ts';

const app = express();
const PORT = parseInt(process.env.PORT || '8080');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure upload directories exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
const videosDir = path.join(uploadsDir, 'videos');
const postersDir = path.join(uploadsDir, 'posters');
[videosDir, postersDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const candidates = [
  path.resolve(process.cwd(), 'dist'),
  path.resolve(__dirname, '..', 'dist'),
];
const distPath = candidates.find(p => fs.existsSync(p)) || candidates[0];
console.log('[Server] PORT:', PORT);
console.log('[Server] distPath:', distPath, 'exists:', fs.existsSync(distPath));

app.use(express.json({ limit: '400mb' }));
app.use(express.urlencoded({ extended: true, limit: '400mb' }));
app.use(cookieParser());

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use('/api', router);

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  const indexPath = path.join(distPath, 'index.html');
  app.get('{*path}', (_req, res) => {
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.status(404).send('not found');
  });
}

app.listen(PORT, '0.0.0.0', () => console.log(`[Server] Listening on 0.0.0.0:${PORT}`));

initDB()
  .then(() => console.log('[Server] DB ready'))
  .catch((e) => console.error('[Server] DB error:', e.message));
