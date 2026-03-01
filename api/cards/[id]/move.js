const trello = require('../../../lib/trelloService');
const { authenticate } = require('../../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await authenticate(req);
    if (!user.trelloToken) return res.status(400).json({ error: 'Trello not connected' });

    const { listId } = req.body;
    if (!listId) return res.status(400).json({ error: 'listId is required' });
    const card = await trello.moveCard(user.trelloToken, req.query.id, listId);
    res.json(card);
  } catch (err) {
    const status = err.statusCode || err.response?.status || 500;
    res.status(status).json({ error: err.response?.data || err.message });
  }
};
