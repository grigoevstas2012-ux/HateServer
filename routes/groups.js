const router = require('express').Router();
const { db, FieldValue } = require('../firebase');
const auth = require('../middleware/auth');

// ── ГРУППЫ ──────────────────────────────────────────────────

router.post('/', auth, async (req, res) => {
  try {
    const { name, members = [] } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Название обязательно' });
    const all = [...new Set([req.uid, ...members])];
    const ref = await db().collection('groups').add({
      name: name.trim(), creatorId: req.uid, members: all,
      admins: [req.uid], e2e: true, createdAt: FieldValue.serverTimestamp(),
    });
    res.status(201).json({ success: true, groupId: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', auth, async (req, res) => {
  try {
    const snap = await db().collection('groups')
      .where('members', 'array-contains', req.uid).get();
    res.json({ groups: snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.()?.toISOString() })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/messages', auth, async (req, res) => {
  try {
    const { text, replyTo, replyText } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Текст пустой' });
    const g = await db().collection('groups').doc(req.params.id).get();
    if (!g.exists) return res.status(404).json({ error: 'Группа не найдена' });
    if (!g.data().members.includes(req.uid)) return res.status(403).json({ error: 'Вы не в группе' });
    const ref = await db().collection('groups').doc(req.params.id)
      .collection('messages').add({
        from: req.uid, text: text.trim(), timestamp: FieldValue.serverTimestamp(),
        deleted: false, edited: false,
        ...(replyTo ? { replyTo } : {}), ...(replyText ? { replyText } : {}),
      });
    await db().collection('groups').doc(req.params.id)
      .update({ lastMessage: text.trim(), lastTime: FieldValue.serverTimestamp() });
    res.status(201).json({ success: true, messageId: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── КАНАЛЫ ──────────────────────────────────────────────────

router.post('/channels', auth, async (req, res) => {
  try {
    const { name, description = '' } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Название обязательно' });
    const ref = await db().collection('channels').add({
      name: name.trim(), description: description.trim(),
      creatorId: req.uid, members: [req.uid], admins: [req.uid],
      e2e: true, createdAt: FieldValue.serverTimestamp(),
    });
    res.status(201).json({ success: true, channelId: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/channels', auth, async (req, res) => {
  try {
    const snap = await db().collection('channels')
      .where('members', 'array-contains', req.uid).get();
    res.json({ channels: snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.()?.toISOString() })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/channels/:id/messages', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Текст пустой' });
    const ch = await db().collection('channels').doc(req.params.id).get();
    if (!ch.exists) return res.status(404).json({ error: 'Канал не найден' });
    if (!ch.data().admins.includes(req.uid)) return res.status(403).json({ error: 'Только администратор' });
    const ref = await db().collection('channels').doc(req.params.id)
      .collection('messages').add({
        from: req.uid, text: text.trim(),
        timestamp: FieldValue.serverTimestamp(), deleted: false,
      });
    await db().collection('channels').doc(req.params.id)
      .update({ lastMessage: text.trim(), lastTime: FieldValue.serverTimestamp() });
    res.status(201).json({ success: true, messageId: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
