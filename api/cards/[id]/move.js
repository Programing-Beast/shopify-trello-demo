const trello = require('../../../lib/trelloService');

module.exports = async function handler(req, res) {
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { listId } = req.body;
    if (!listId) return res.status(400).json({ error: 'listId is required' });
    const card = await trello.moveCard(req.query.id, listId);
    res.json(card);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data || err.message });
  }
};
