const trello = require('../../lib/trelloService');

module.exports = async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await trello.deleteWebhook(req.query.id);
    res.json({ success: true });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data || err.message });
  }
};
