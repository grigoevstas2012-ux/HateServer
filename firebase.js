require('dotenv').config();
const admin = require('firebase-admin');
const path  = require('path');
const fs    = require('fs');

function init() {
  // Путь к ключу
  const keyPath = path.resolve(
    process.env.FIREBASE_SERVICE_ACCOUNT || './serviceAccountKey.json'
  );

  // Если переменная окружения с JSON (Railway/Render)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({ credential: admin.credential.cert(sa) });
      console.log('✅ Firebase: инициализирован из ENV');
      return;
    } catch (e) {
      console.error('❌ Ошибка парсинга FIREBASE_SERVICE_ACCOUNT_JSON:', e.message);
      process.exit(1);
    }
  }

  // Локальный файл — обязателен
  if (!fs.existsSync(keyPath)) {
    console.error('\n╔══════════════════════════════════════════════════════╗');
    console.error('║  ❌  serviceAccountKey.json НЕ НАЙДЕН               ║');
    console.error('╠══════════════════════════════════════════════════════╣');
    console.error('║  Как получить:                                       ║');
    console.error('║  1. console.firebase.google.com                      ║');
    console.error('║  2. Проект: weed-messenger-8200e                     ║');
    console.error('║  3. ⚙️  Project Settings → Service accounts          ║');
    console.error('║  4. "Generate new private key"                       ║');
    console.error('║  5. Сохрани как serviceAccountKey.json рядом         ║');
    console.error('║     с server.js                                      ║');
    console.error('╚══════════════════════════════════════════════════════╝\n');
    process.exit(1);
  }

  const sa = require(keyPath);
  admin.initializeApp({
    credential:    admin.credential.cert(sa),
    projectId:     'weed-messenger-8200e',
    storageBucket: 'weed-messenger-8200e.firebasestorage.app',
  });
  console.log(`✅ Firebase Admin SDK → weed-messenger-8200e`);
  console.log(`🔑 Key: ${path.basename(keyPath)}`);
}

init();

module.exports = {
  db:         () => admin.firestore(),
  auth:       () => admin.auth(),
  storage:    () => admin.storage().bucket(),
  FieldValue: admin.firestore.FieldValue,
};
