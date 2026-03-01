const trello = require('../../lib/trelloService');
const store = require('../../lib/store');

module.exports = async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const webhookId = req.query.id;
    // Find which board this webhook belongs to and remove it
    const webhooks = await store.getWebhooks();
    for (const [boardId, wh] of Object.entries(webhooks)) {
      if (wh.webhookId === webhookId) {
        await store.removeWebhook(boardId);
        break;
      }
    }
    await trello.deleteWebhook(webhookId);
    res.json({ success: true });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data || err.message });
  }
};
