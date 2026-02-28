const trello = require('../../../lib/trelloService');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const card = await trello.getCardDetails(req.query.id);
    res.json(card);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data || err.message });
  }
};
