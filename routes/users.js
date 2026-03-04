const router = require('express').Router();
const { db, FieldValue } = require('../firebase');
const auth = require('../middleware/auth');

// GET /api/users/me
router.get('/me', auth, async (req, res) => {
  try {
    const doc = await db().collection('users').doc(req.uid).get();
    if (!doc.exists) return res.status(404).json({ error: 'Не найден' });
    const u = { uid: req.uid, ...doc.data() };
    if (u.hideEmail) delete u.email;
    res.json(u);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/users/me — обновить профиль
// username проверяется на уникальность: если занят → 409
router.patch('/me', auth, async (req, res) => {
  try {
    const allowed = ['name', 'username', 'bio', 'color', 'hideEmail', 'hideLastSeen', 'publicKey'];
    const update  = {};
    for (const k of allowed) if (req.body[k] !== undefined) update[k] = req.body[k];
    if (!Object.keys(update).length) return res.status(400).json({ error: 'Нечего обновлять' });

    // Проверка уникальности @username
    if (update.username) {
      const ex = await db().collection('users')
        .where('username', '==', update.username).limit(1).get();
      if (!ex.empty && ex.docs[0].id !== req.uid) {
        return res.status(409).json({
          error: `@${update.username} уже занят — выберите другой`,
        });
      }
    }

    update.updatedAt = FieldValue.serverTimestamp();
    await db().collection('users').doc(req.uid).set(update, { merge: true });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/users/check-username?username=foo — проверить занятость
router.get('/check-username', auth, async (req, res) => {
  try {
    const username = (req.query.username || '').toLowerCase().trim();
    if (!username) return res.status(400).json({ error: 'username обязателен' });
    const snap = await db().collection('users')
      .where('username', '==', username).limit(1).get();
    const taken = !snap.empty && snap.docs[0].id !== req.uid;
    res.json({ username, available: !taken });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/users/search?q=
router.get('/search', auth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim().replace('@', '');
    if (q.length < 2) return res.status(400).json({ error: 'Запрос слишком короткий' });

    let snap = await db().collection('users').where('username', '==', q).limit(10).get();
    if (snap.empty) snap = await db().collection('users').where('name', '==', q).limit(10).get();

    const users = snap.docs.filter(d => d.id !== req.uid).map(d => {
      const u = d.data();
      return {
        uid: d.id, name: u.name, username: u.username || null,
        color: u.color, online: !!u.online,
        ...(u.hideEmail ? {} : { email: u.email }),
      };
    });
    res.json({ users });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/users/:uid — публичный профиль
router.get('/:uid', auth, async (req, res) => {
  try {
    const doc = await db().collection('users').doc(req.params.uid).get();
    if (!doc.exists) return res.status(404).json({ error: 'Не найден' });
    const u = doc.data();
    const lastSeen = u.hideLastSeen ? null : (u.lastSeen?.toDate?.()?.toISOString() || null);
    res.json({
      uid: req.params.uid, name: u.name, username: u.username || null,
      color: u.color, online: !!u.online, bio: u.bio || '',
      publicKey: u.publicKey || null, lastSeen,
      ...(u.hideEmail ? {} : { email: u.email }),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/users/me/online
router.patch('/me/online', auth, async (req, res) => {
  try {
    await db().collection('users').doc(req.uid).set({
      online: !!req.body.online,
      lastSeen: FieldValue.serverTimestamp(),
    }, { merge: true });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users/me/contacts
router.post('/me/contacts', auth, async (req, res) => {
  try {
    const { targetUid } = req.body;
    if (!targetUid)          return res.status(400).json({ error: 'targetUid обязателен' });
    if (targetUid === req.uid) return res.status(400).json({ error: 'Нельзя добавить себя' });
    const ex = await db().collection('users').doc(targetUid).get();
    if (!ex.exists) return res.status(404).json({ error: 'Пользователь не найден' });
    await db().collection('users').doc(req.uid)
      .collection('contacts').doc(targetUid)
      .set({ addedAt: FieldValue.serverTimestamp() });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
