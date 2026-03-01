const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'fallback_dev_secret';

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

async function authenticate(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    const err = new Error('Missing or invalid Authorization header');
    err.statusCode = 401;
    throw err;
  }

  const token = header.slice(7);
  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    const err = new Error('Invalid or expired token');
    err.statusCode = 401;
    throw err;
  }

  const store = require('./store');
  const user = await store.getUser(decoded.email);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 401;
    throw err;
  }

  return user;
}

module.exports = { signToken, verifyToken, authenticate };
