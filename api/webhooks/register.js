const trello = require('../../lib/trelloService');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { callbackURL, boardId } = req.body;
    if (!callbackURL || !boardId) {
      return res.status(400).json({ error: 'callbackURL and boardId are required' });
    }
    const webhook = await trello.createWebhook(callbackURL, boardId);
    res.json(webhook);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data || err.message });
  }
};
