const axios = require('axios');
const FormData = require('form-data');
const trelloConfig = require('./trelloConfig');

const client = axios.create({
  baseURL: trelloConfig.baseURL,
});

function authParams() {
  return { key: trelloConfig.key, token: trelloConfig.token };
}

async function getBoards() {
  const { data } = await client.get('/1/members/me/boards', {
    params: { ...authParams(), fields: 'name,url,shortLink' },
  });
  return data;
}

async function getBoardLists(boardId) {
  const { data } = await client.get(`/1/boards/${boardId}/lists`, {
    params: { ...authParams(), cards: 'open', card_fields: 'name,idList,labels,due,shortUrl' },
  });
  return data;
}

async function getCardDetails(cardId) {
  const { data } = await client.get(`/1/cards/${cardId}`, {
    params: { ...authParams(), attachments: true, actions: 'commentCard', actions_limit: 20 },
  });
  return data;
}

async function moveCard(cardId, listId) {
  const { data } = await client.put(`/1/cards/${cardId}`, null, {
    params: { ...authParams(), idList: listId },
  });
  return data;
}

async function addComment(cardId, text) {
  const { data } = await client.post(`/1/cards/${cardId}/actions/comments`, null, {
    params: { ...authParams(), text },
  });
  return data;
}

async function addAttachment(cardId, file) {
  const form = new FormData();
  form.append('key', trelloConfig.key);
  form.append('token', trelloConfig.token);
  form.append('file', file.buffer, { filename: file.originalname, contentType: file.mimetype });

  const { data } = await client.post(`/1/cards/${cardId}/attachments`, form, {
    headers: form.getHeaders(),
  });
  return data;
}

async function createWebhook(callbackURL, idModel) {
  const { data } = await client.post('/1/webhooks', null, {
    params: { ...authParams(), callbackURL, idModel },
  });
  return data;
}

async function deleteWebhook(webhookId) {
  const { data } = await client.delete(`/1/webhooks/${webhookId}`, {
    params: authParams(),
  });
  return data;
}

module.exports = {
  getBoards,
  getBoardLists,
  getCardDetails,
  moveCard,
  addComment,
  addAttachment,
  createWebhook,
  deleteWebhook,
};
