const store = require('../../lib/store');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const data = await store.getEvents();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
