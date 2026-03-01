const trello = require('../../lib/trelloService');
const store = require('../../lib/store');
const { authenticate } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await authenticate(req);
    if (!user.trelloToken) return res.status(400).json({ error: 'Trello not connected' });

    const webhookId = req.query.id;
    const webhooks = await store.getUserWebhooks(user.email);
    for (const [boardId, wh] of Object.entries(webhooks)) {
      if (wh.webhookId === webhookId) {
        await store.removeUserWebhook(user.email, boardId);
        await store.unmapBoardFromUser(boardId);
        break;
      }
    }
    await trello.deleteWebhook(user.trelloToken, webhookId);
    res.json({ success: true });
  } catch (err) {
    const status = err.statusCode || err.response?.status || 500;
    res.status(status).json({ error: err.response?.data || err.message });
  }
};
