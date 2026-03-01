const store = require('../../lib/store');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const webhooks = await store.getWebhooks();
    res.json(webhooks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
