const router = require('express').Router();
const { db, FieldValue } = require('../firebase');
const auth = require('../middleware/auth');

// Детерминированный ID чата из двух uid
const chatId = (a, b) => [a, b].sort().join('_');

// ── POST /api/messages/send ───────────────────────────────────────────────
// Пример защищённого роута: uid берётся из req.uid (verifyIdToken),
// данные записываются в Firestore через admin.firestore()
router.post('/send', auth, async (req, res) => {
  try {
    const { to, text, replyTo, replyText } = req.body;
    const from = req.uid; // ← из токена, не из тела

    if (!to)           return res.status(400).json({ error: '"to" обязателен' });
    if (!text?.trim()) return res.status(400).json({ error: 'Текст пустой' });

    const cid = chatId(from, to);
    const msg = {
      from, to,
      text:      text.trim(),
      timestamp: FieldValue.serverTimestamp(),
      deleted:   false,
      edited:    false,
      read:      false,
      ...(replyTo   ? { replyTo }   : {}),
      ...(replyText ? { replyText } : {}),
    };

    // Запись в Firestore: chats/{chatId}/messages/{autoId}
    const ref = await db().collection('chats').doc(cid)
                          .collection('messages').add(msg);

    // Обновляем метаданные чата
    await db().collection('chats').doc(cid).set({
      lastMessage:      text.trim(),
      lastTime:         FieldValue.serverTimestamp(),
      participants:     [from, to],
      [`unread_${to}`]: FieldValue.increment(1),
    }, { merge: true });

    res.status(201).json({ success: true, messageId: ref.id, chatId: cid });
  } catch (e) {
    console.error('[messages/send]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/messages/:chatId
router.get('/:chatId', auth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50'), 200);
    const snap  = await db().collection('chats').doc(req.params.chatId)
      .collection('messages').orderBy('timestamp', 'desc').limit(limit).get();

    const messages = snap.docs.reverse().map(d => ({
      id: d.id, ...d.data(),
      timestamp: d.data().timestamp?.toDate?.()?.toISOString() || null,
    }));
    res.json({ messages });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/messages/:chatId/:msgId
router.delete('/:chatId/:msgId', auth, async (req, res) => {
  try {
    const ref = db().collection('chats').doc(req.params.chatId)
                    .collection('messages').doc(req.params.msgId);
    const doc = await ref.get();
    if (!doc.exists)                 return res.status(404).json({ error: 'Не найдено' });
    if (doc.data().from !== req.uid) return res.status(403).json({ error: 'Нет прав' });
    await ref.update({ deleted: true, text: '' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/messages/:chatId/:msgId  — изменить текст
router.patch('/:chatId/:msgId', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Текст пустой' });
    const ref = db().collection('chats').doc(req.params.chatId)
                    .collection('messages').doc(req.params.msgId);
    const doc = await ref.get();
    if (!doc.exists)                 return res.status(404).json({ error: 'Не найдено' });
    if (doc.data().from !== req.uid) return res.status(403).json({ error: 'Нет прав' });
    await ref.update({ text: text.trim(), edited: true });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/messages/:chatId/:msgId/read
router.patch('/:chatId/:msgId/read', auth, async (req, res) => {
  try {
    await db().collection('chats').doc(req.params.chatId)
              .collection('messages').doc(req.params.msgId).update({ read: true });
    await db().collection('chats').doc(req.params.chatId)
              .set({ [`unread_${req.uid}`]: 0 }, { merge: true });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
