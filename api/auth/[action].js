const bcrypt = require('bcryptjs');
const axios = require('axios');
const store = require('../../lib/store');
const { signToken, authenticate } = require('../../lib/auth');

async function handleRegister(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password, name, avatar } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password, and name are required' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await store.createUser({ email, password: hashed, name, avatar: avatar || '' });

  const token = signToken({ email: user.email });
  res.json({
    token,
    user: { email: user.email, name: user.name, avatar: user.avatar },
  });
}

async function handleLogin(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = await store.getUser(email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  const token = signToken({ email: user.email });
  res.json({
    token,
    user: {
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      trelloConnected: !!user.trelloToken,
    },
  });
}

async function handleMe(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await authenticate(req);
  res.json({
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    trelloConnected: !!user.trelloToken,
  });
}

async function handleConnectTrello(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await authenticate(req);
  const { trelloToken } = req.body;
  if (!trelloToken) return res.status(400).json({ error: 'trelloToken is required' });

  const key = process.env.TRELLO_API_KEY;
  const { data: member } = await axios.get('https://api.trello.com/1/members/me', {
    params: { key, token: trelloToken, fields: 'fullName,username' },
  });

  await store.updateUser(user.email, { trelloToken });
  res.json({
    success: true,
    trelloUser: { fullName: member.fullName, username: member.username },
  });
}

async function handleAvatar(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await authenticate(req);
  const { avatar } = req.body;
  if (!avatar) return res.status(400).json({ error: 'avatar (base64) is required' });

  await store.updateUser(user.email, { avatar });
  res.json({ success: true, avatar });
}

async function handleConfig(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  res.json({
    trelloApiKey: process.env.TRELLO_API_KEY,
    appUrl: process.env.APP_URL || '',
  });
}

const handlers = {
  register: handleRegister,
  login: handleLogin,
  me: handleMe,
  'connect-trello': handleConnectTrello,
  avatar: handleAvatar,
  config: handleConfig,
};

module.exports = async function handler(req, res) {
  try {
    const action = req.query.action;
    const fn = handlers[action];
    if (!fn) return res.status(404).json({ error: 'Not found' });
    await fn(req, res);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    if (err.response?.status === 401) return res.status(400).json({ error: 'Invalid Trello token' });
    res.status(500).json({ error: err.message });
  }
};
