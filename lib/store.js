const { Redis } = require('@upstash/redis');

const MAX_EVENTS = 100;
const BOARD_USER_MAP_KEY = 'board_user_map';
const USERS_INDEX_KEY = 'users:index';

let redis = null;

function getRedis() {
  if (!redis && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

// --- User CRUD ---

async function createUser({ email, password, name, avatar }) {
  const r = getRedis();
  if (!r) throw new Error('Redis not configured');

  const existing = await r.hgetall(`user:${email}`);
  if (existing && Object.keys(existing).length > 0) {
    const err = new Error('Email already registered');
    err.statusCode = 409;
    throw err;
  }

  const user = {
    email,
    password,
    name: name || '',
    avatar: avatar || '',
    trelloToken: '',
    boards: '[]',
    createdAt: new Date().toISOString(),
  };
  await r.hset(`user:${email}`, user);
  await r.sadd(USERS_INDEX_KEY, email);
  return user;
}

async function getUser(email) {
  const r = getRedis();
  if (!r) return null;
  const data = await r.hgetall(`user:${email}`);
  if (!data || Object.keys(data).length === 0) return null;
  return data;
}

async function updateUser(email, fields) {
  const r = getRedis();
  if (!r) return;
  await r.hset(`user:${email}`, fields);
}

// --- User-scoped webhook events ---

function eventsKey(email) { return `webhook_events:${email}`; }
function versionKey(email) { return `board_version:${email}`; }
function webhooksKey(email) { return `registered_webhooks:${email}`; }

async function addUserEvent(email, event) {
  const r = getRedis();
  if (!r) {
    console.log('No Redis configured — webhook event logged only:', event.type, event.card);
    return;
  }
  await r.lpush(eventsKey(email), JSON.stringify(event));
  await r.ltrim(eventsKey(email), 0, MAX_EVENTS - 1);
  await r.incr(versionKey(email));
}

async function getUserEvents(email) {
  const r = getRedis();
  if (!r) return { version: 0, events: [] };

  const [version, events] = await Promise.all([
    r.get(versionKey(email)),
    r.lrange(eventsKey(email), 0, MAX_EVENTS - 1),
  ]);

  return {
    version: parseInt(version || '0'),
    events: events.map(e => typeof e === 'string' ? JSON.parse(e) : e),
  };
}

// --- User-scoped webhook registration ---

async function saveUserWebhook(email, boardId, webhookId, callbackURL) {
  const r = getRedis();
  if (!r) return;
  await r.hset(webhooksKey(email), {
    [boardId]: JSON.stringify({ webhookId, callbackURL, boardId, createdAt: new Date().toISOString() }),
  });
}

async function removeUserWebhook(email, boardId) {
  const r = getRedis();
  if (!r) return;
  await r.hdel(webhooksKey(email), boardId);
}

async function getUserWebhooks(email) {
  const r = getRedis();
  if (!r) return {};
  const data = await r.hgetall(webhooksKey(email));
  if (!data) return {};
  const result = {};
  for (const [boardId, val] of Object.entries(data)) {
    result[boardId] = typeof val === 'string' ? JSON.parse(val) : val;
  }
  return result;
}

// --- Board → User mapping ---

async function mapBoardToUser(boardId, email) {
  const r = getRedis();
  if (!r) return;
  await r.hset(BOARD_USER_MAP_KEY, { [boardId]: email });
}

async function getUserForBoard(boardId) {
  const r = getRedis();
  if (!r) return null;
  return await r.hget(BOARD_USER_MAP_KEY, boardId);
}

async function unmapBoardFromUser(boardId) {
  const r = getRedis();
  if (!r) return;
  await r.hdel(BOARD_USER_MAP_KEY, boardId);
}

module.exports = {
  addUserEvent,
  getUserEvents,
  saveUserWebhook,
  removeUserWebhook,
  getUserWebhooks,
  createUser,
  getUser,
  updateUser,
  mapBoardToUser,
  getUserForBoard,
  unmapBoardFromUser,
};
