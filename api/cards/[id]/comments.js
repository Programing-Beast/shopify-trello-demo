const trello = require('../../../lib/trelloService');
const { authenticate } = require('../../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await authenticate(req);
    if (!user.trelloToken) return res.status(400).json({ error: 'Trello not connected' });

    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });
    const comment = await trello.addComment(user.trelloToken, req.query.id, text);
    res.json(comment);
  } catch (err) {
    const status = err.statusCode || err.response?.status || 500;
    res.status(status).json({ error: err.response?.data || err.message });
  }
};
