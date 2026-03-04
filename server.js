// ═══════════════════════════════════════════════════════════
//  Hate Server  v2.0
//  ─────────────────────────────────────────────────────────
//  • Запуск:    ./start.sh   |   start.bat   |   node server.js
//  • Хранилище: Firebase Firestore (сервер сам ничего не хранит)
//  • Auth:      Firebase ID Token → Authorization: Bearer <token>
//  • Без serviceAccountKey.json — сервер не стартует
// ═══════════════════════════════════════════════════════════
require('dotenv').config();
require('./firebase'); // ← если нет ключа — process.exit(1)

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 мин
  max: 400,
  standardHeaders: true,
  message: { error: 'Слишком много запросов, подожди немного' },
}));

// ── Роуты (все /api/* защищены через Bearer token) ────────
app.use('/api/messages', require('./routes/messages'));
app.use('/api/users',    require('./routes/users'));
app.use('/api/groups',   require('./routes/groups'));

// ── Health check — публичный, используется SplashActivity ─
app.get('/', (req, res) => {
  res.json({
    status:   'ok',
    service:  '🔥 Hate Server',
    version:  '2.0.0',
    firebase: 'weed-messenger-8200e',
    storage:  'Firebase Firestore',
    e2e:      'ECDH P-256 + AES-256-GCM',
    auth:     'Firebase ID Token (Authorization: Bearer)',
    endpoints: [
      'POST   /api/messages/send',
      'GET    /api/messages/:chatId',
      'DELETE /api/messages/:chatId/:msgId',
      'PATCH  /api/messages/:chatId/:msgId',
      'PATCH  /api/messages/:chatId/:msgId/read',
      'GET    /api/users/me',
      'PATCH  /api/users/me',
      'GET    /api/users/check-username?username=',
      'GET    /api/users/search?q=',
      'GET    /api/users/:uid',
      'PATCH  /api/users/me/online',
      'POST   /api/users/me/contacts',
      'POST   /api/groups',
      'GET    /api/groups',
      'POST   /api/groups/:id/messages',
      'POST   /api/groups/channels',
      'GET    /api/groups/channels',
      'POST   /api/groups/channels/:id/messages',
    ],
  });
});

// ── 404 ──────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Не найдено: ${req.method} ${req.path}` });
});

// ── Error handler ─────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// ── Старт ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log(`║  🔥  Hate Server запущен                     ║`);
  console.log(`║  📡  http://localhost:${PORT}                    ║`);
  console.log(`║  📦  Firebase: weed-messenger-8200e          ║`);
  console.log(`║  🔒  E2E: ECDH P-256 + AES-256-GCM          ║`);
  console.log(`║  💾  Данные: Firebase Firestore              ║`);
  console.log('╚══════════════════════════════════════════════╝\n');
});
