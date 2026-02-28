const store = require('../../lib/store');

const handler = async (req, res) => {
  // HEAD — Trello webhook verification
  if (req.method === 'HEAD') {
    return res.status(200).end();
  }

  // POST — receive board update events
  if (req.method === 'POST') {
    const action = req.body?.action || {};
    const model = req.body?.model || {};

    const event = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      type: action.type || 'unknown',
      memberCreator: action.memberCreator?.fullName || 'unknown',
      card: action.data?.card?.name || null,
      listBefore: action.data?.listBefore?.name || null,
      listAfter: action.data?.listAfter?.name || null,
      board: action.data?.board?.name || model.name || null,
      text: action.data?.text || null,
      raw: action,
    };

    await store.addEvent(event);
    console.log(`Webhook [${event.type}]: card="${event.card}" listBefore="${event.listBefore}" listAfter="${event.listAfter}"`);
    return res.status(200).end();
  }

  res.status(405).json({ error: 'Method not allowed' });
};

module.exports = handler;
