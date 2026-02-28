function errorHandler(err, req, res, next) {
  console.error('Error:', err.message);

  if (err.response) {
    // Trello API error
    return res.status(err.response.status).json({
      error: err.response.data || err.message,
    });
  }

  res.status(500).json({ error: err.message || 'Internal server error' });
}

module.exports = errorHandler;
