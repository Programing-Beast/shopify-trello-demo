const { Router } = require('express');
const trello = require('../services/trelloService');

const router = Router();

// GET /api/boards — list all boards
router.get('/', async (req, res, next) => {
  try {
    const boards = await trello.getBoards();
    res.json(boards);
  } catch (err) {
    next(err);
  }
});

// GET /api/boards/:id — board with lists & cards
router.get('/:id', async (req, res, next) => {
  try {
    const lists = await trello.getBoardLists(req.params.id);
    res.json(lists);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
