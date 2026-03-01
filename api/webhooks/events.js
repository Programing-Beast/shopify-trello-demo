const store = require('../../lib/store');
const { authenticate } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await authenticate(req);
    const data = await store.getUserEvents(user.email);
    res.json(data);
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
  }
};
