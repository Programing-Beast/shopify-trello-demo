const axios = require('axios');
const FormData = require('form-data');
const trelloConfig = require('./trelloConfig');

const client = axios.create({
  baseURL: trelloConfig.baseURL,
});

function authParams(token) {
  return { key: trelloConfig.key, token };
}

async function getBoards(token) {
  const { data } = await client.get('/1/members/me/boards', {
    params: { ...authParams(token), fields: 'name,url,shortLink' },
  });
  return data;
}

async function getBoardLists(token, boardId) {
  const { data } = await client.get(`/1/boards/${boardId}/lists`, {
    params: { ...authParams(token), cards: 'open', card_fields: 'name,idList,labels,due,shortUrl' },
  });
  return data;
}

async function getCardDetails(token, cardId) {
  const { data } = await client.get(`/1/cards/${cardId}`, {
    params: { ...authParams(token), attachments: true, actions: 'commentCard', actions_limit: 20 },
  });
  return data;
}

async function moveCard(token, cardId, listId) {
  const { data } = await client.put(`/1/cards/${cardId}`, null, {
    params: { ...authParams(token), idList: listId },
  });
  return data;
}

async function addComment(token, cardId, text) {
  const { data } = await client.post(`/1/cards/${cardId}/actions/comments`, null, {
    params: { ...authParams(token), text },
  });
  return data;
}

async function addAttachment(token, cardId, file) {
  const form = new FormData();
  form.append('key', trelloConfig.key);
  form.append('token', token);
  form.append('file', file.buffer, { filename: file.originalname, contentType: file.mimetype });

  const { data } = await client.post(`/1/cards/${cardId}/attachments`, form, {
    headers: form.getHeaders(),
  });
  return data;
}

async function createWebhook(token, callbackURL, idModel) {
  const { data } = await client.post('/1/webhooks', null, {
    params: { ...authParams(token), callbackURL, idModel },
  });
  return data;
}

async function deleteWebhook(token, webhookId) {
  const { data } = await client.delete(`/1/webhooks/${webhookId}`, {
    params: authParams(token),
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
