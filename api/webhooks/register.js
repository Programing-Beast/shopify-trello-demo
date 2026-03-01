const trello = require('../../lib/trelloService');
const store = require('../../lib/store');
const { authenticate } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await authenticate(req);
    if (!user.trelloToken) return res.status(400).json({ error: 'Trello not connected' });

    const { callbackURL, boardId } = req.body;
    if (!callbackURL || !boardId) {
      return res.status(400).json({ error: 'callbackURL and boardId are required' });
    }
    const webhook = await trello.createWebhook(user.trelloToken, callbackURL, boardId);
    await store.saveUserWebhook(user.email, boardId, webhook.id, callbackURL);
    await store.mapBoardToUser(boardId, user.email);
    res.json(webhook);
  } catch (err) {
    const status = err.statusCode || err.response?.status || 500;
    res.status(status).json({ error: err.response?.data || err.message });
  }
};
