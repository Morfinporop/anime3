import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDB } from './db.ts';
import { router } from './routes.ts';

const app = express();
const PORT = parseInt(process.env.PORT || '3000');

// Определяем путь к dist
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Пробуем несколько вариантов пути к dist
const candidates = [
  path.resolve('dist'),
  path.resolve(__dirname, '..', 'dist'),
  path.resolve(process.cwd(), 'dist'),
];
let distPath = candidates.find(p => fs.existsSync(p)) || candidates[0];
console.log('[Server] CWD:', process.cwd());
console.log('[Server] __dirname:', __dirname);
console.log('[Server] distPath:', distPath, 'exists:', fs.existsSync(distPath));

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

// Serve static files from dist
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  
  // SPA fallback — все остальные маршруты → index.html
  const indexPath = path.join(distPath, 'index.html');
  app.get('*', (_req, res) => {
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('index.html not found');
    }
  });
} else {
  app.get('*', (_req, res) => {
    res.status(503).json({ error: 'Frontend not built' });
  });
}

// Запускаем сервер сразу, БД инициализируем асинхронно
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Listening on 0.0.0.0:${PORT}`);
});

initDB()
  .then(() => console.log('[Server] DB initialized successfully'))
  .catch((err) => console.error('[Server] DB init error:', err.message));
