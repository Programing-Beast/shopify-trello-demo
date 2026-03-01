const { Redis } = require('@upstash/redis');

const MAX_EVENTS = 100;
const EVENTS_KEY = 'webhook_events';
const VERSION_KEY = 'board_version';

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

async function addEvent(event) {
  const r = getRedis();
  if (!r) {
    console.log('No Redis configured — webhook event logged only:', event.type, event.card);
    return;
  }
  await r.lpush(EVENTS_KEY, JSON.stringify(event));
  await r.ltrim(EVENTS_KEY, 0, MAX_EVENTS - 1);
  await r.incr(VERSION_KEY);
}

async function getEvents() {
  const r = getRedis();
  if (!r) return { version: 0, events: [] };

  const [version, events] = await Promise.all([
    r.get(VERSION_KEY),
    r.lrange(EVENTS_KEY, 0, MAX_EVENTS - 1),
  ]);

  return {
    version: parseInt(version || '0'),
    events: events.map(e => typeof e === 'string' ? JSON.parse(e) : e),
  };
}

// --- Webhook registration persistence ---
const WEBHOOKS_KEY = 'registered_webhooks';

async function saveWebhook(boardId, webhookId, callbackURL) {
  const r = getRedis();
  if (!r) return;
  await r.hset(WEBHOOKS_KEY, { [boardId]: JSON.stringify({ webhookId, callbackURL, boardId, createdAt: new Date().toISOString() }) });
}

async function removeWebhook(boardId) {
  const r = getRedis();
  if (!r) return;
  await r.hdel(WEBHOOKS_KEY, boardId);
}

async function getWebhooks() {
  const r = getRedis();
  if (!r) return {};
  const data = await r.hgetall(WEBHOOKS_KEY);
  if (!data) return {};
  const result = {};
  for (const [boardId, val] of Object.entries(data)) {
    result[boardId] = typeof val === 'string' ? JSON.parse(val) : val;
  }
  return result;
}

module.exports = { addEvent, getEvents, saveWebhook, removeWebhook, getWebhooks };
