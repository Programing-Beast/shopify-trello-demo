const { Router } = require('express');
const trello = require('../services/trelloService');

const router = Router();

// In-memory event store
const events = [];
const MAX_EVENTS = 100;
let boardVersion = 0;

// HEAD /webhooks/trello — Trello webhook verification
router.head('/trello', (req, res) => {
  res.sendStatus(200);
});

// POST /webhooks/trello — receive board update events
router.post('/trello', (req, res) => {
  const action = req.body.action || {};
  const model = req.body.model || {};
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
  events.unshift(event);
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
  boardVersion++;
  console.log(`Webhook [${event.type}]: card="${event.card}" listBefore="${event.listBefore}" listAfter="${event.listAfter}"`);
  res.sendStatus(200);
});

// GET /api/webhooks/events — list recent events + board version
router.get('/events', (req, res) => {
  res.json({ version: boardVersion, events });
});

// POST /api/webhooks/register — register a webhook for a board
router.post('/register', async (req, res, next) => {
  try {
    const { callbackURL, boardId } = req.body;
    if (!callbackURL || !boardId) {
      return res.status(400).json({ error: 'callbackURL and boardId are required' });
    }
    const webhook = await trello.createWebhook(callbackURL, boardId);
    res.json(webhook);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/webhooks/:id — delete a webhook
router.delete('/:id', async (req, res, next) => {
  try {
    await trello.deleteWebhook(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
