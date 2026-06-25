import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDB } from './db.js';
import { router } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '3000');

// Middleware
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(cookieParser());

// CORS
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

// API routes
app.use('/api', router);

// Serve static files
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Start server — не падаем если БД недоступна, продолжаем слушать порт
initDB()
  .then(() => console.log('[Server] DB initialized'))
  .catch((err) => console.error('[Server] DB init failed:', err.message));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Listening on port ${PORT}`);
});
