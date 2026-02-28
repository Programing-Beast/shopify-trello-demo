require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const boardsRouter = require('./routes/boards');
const cardsRouter = require('./routes/cards');
const webhooksRouter = require('./routes/webhooks');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'client')));

// API routes
app.use('/api/boards', boardsRouter);
app.use('/api/cards', cardsRouter);

// Webhook routes — HEAD/POST at /webhooks/trello, management at /api/webhooks/*
app.use('/webhooks', webhooksRouter);
app.use('/api/webhooks', webhooksRouter);

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
