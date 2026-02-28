const { Router } = require('express');
const multer = require('multer');
const trello = require('../services/trelloService');

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/cards/:id — card details
router.get('/:id', async (req, res, next) => {
  try {
    const card = await trello.getCardDetails(req.params.id);
    res.json(card);
  } catch (err) {
    next(err);
  }
});

// PUT /api/cards/:id/move — move card to target list
router.put('/:id/move', async (req, res, next) => {
  try {
    const { listId } = req.body;
    if (!listId) return res.status(400).json({ error: 'listId is required' });
    const card = await trello.moveCard(req.params.id, listId);
    res.json(card);
  } catch (err) {
    next(err);
  }
});

// POST /api/cards/:id/comments — add comment
router.post('/:id/comments', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });
    const comment = await trello.addComment(req.params.id, text);
    res.json(comment);
  } catch (err) {
    next(err);
  }
});

// POST /api/cards/:id/attachments — upload & attach file
router.post('/:id/attachments', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });
    const attachment = await trello.addAttachment(req.params.id, req.file);
    res.json(attachment);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
