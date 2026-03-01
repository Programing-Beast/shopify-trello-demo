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

    const boardId = action.data?.board?.id || model.id || null;

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

    // Route event to the user who owns this board
    if (boardId) {
      try {
        const email = await store.getUserForBoard(boardId);
        if (email) {
          await store.addUserEvent(email, event);
          console.log(`Webhook [${event.type}] → user=${email}: card="${event.card}"`);
          return res.status(200).end();
        }
      } catch (err) {
        console.error(`Webhook store error for board=${boardId}:`, err.message);
        return res.status(200).end();
      }
    }

    // No board mapping found — log and accept
    console.log(`Webhook [${event.type}]: no user mapping for board=${boardId}`);
    return res.status(200).end();
  }

  res.status(405).json({ error: 'Method not allowed' });
};

module.exports = handler;
