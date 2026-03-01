const { createApp, ref, watch, onMounted } = Vue;

createApp({
  setup() {
    const boards = ref([]);
    const selectedBoardId = ref('');
    const lists = ref([]);
    const loading = ref(false);
    const errorMsg = ref('');

    // Card detail
    const selectedCard = ref(null);
    const cardDetail = ref(null);
    const moveTargetListId = ref('');
    const commentText = ref('');
    const fileInput = ref(null);

    // Webhooks
    const webhookURL = ref(window.location.origin + '/api/webhooks/trello');
    const activeWebhookId = ref('');
    const savedWebhooks = ref({});
    const webhookEvents = ref([]);
    let pollInterval = null;
    let lastVersion = 0;

    // Auth
    const currentUser = ref(null);
    const toasts = ref([]);
    let toastId = 0;

    function addToast(message, type) {
      const id = ++toastId;
      toasts.value.push({ id, message, type: type || 'info' });
      setTimeout(() => {
        toasts.value = toasts.value.filter(t => t.id !== id);
      }, 5000);
    }

    // Auth helpers
    function getToken() {
      return localStorage.getItem('token');
    }

    async function apiFetch(url, opts = {}) {
      const token = getToken();
      if (!token) {
        window.location.href = '/login.html';
        throw new Error('Not authenticated');
      }
      const headers = { ...(opts.headers || {}) };
      headers['Authorization'] = 'Bearer ' + token;
      const res = await fetch(url, { ...opts, headers });
      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
        throw new Error('Session expired');
      }
      return res;
    }

    function logout() {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login.html';
    }

    async function checkAuth() {
      const token = getToken();
      if (!token) {
        window.location.href = '/login.html';
        return false;
      }
      try {
        const res = await apiFetch('/api/auth/me');
        const user = await res.json();
        if (!res.ok) throw new Error(user.error);
        currentUser.value = user;

        if (!user.trelloConnected) {
          window.location.href = '/register.html?step=trello';
          return false;
        }
        return true;
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
        return false;
      }
    }

    async function fetchBoards() {
      try {
        const res = await apiFetch('/api/boards');
        boards.value = await res.json();
      } catch (e) {
        errorMsg.value = 'Failed to load boards: ' + e.message;
      }
    }

    async function fetchSavedWebhooks() {
      try {
        const res = await apiFetch('/api/webhooks/list');
        savedWebhooks.value = await res.json();
      } catch { /* ignore */ }
    }

    async function loadBoard() {
      if (!selectedBoardId.value) { lists.value = []; return; }
      loading.value = true;
      errorMsg.value = '';
      try {
        const res = await apiFetch(`/api/boards/${selectedBoardId.value}`);
        lists.value = await res.json();
      } catch (e) {
        errorMsg.value = 'Failed to load board: ' + e.message;
      } finally {
        loading.value = false;
      }
      // Load saved webhook for this board
      const saved = savedWebhooks.value[selectedBoardId.value];
      if (saved) {
        activeWebhookId.value = saved.webhookId;
        webhookURL.value = saved.callbackURL;
      } else {
        activeWebhookId.value = '';
      }
    }

    async function selectCard(card) {
      selectedCard.value = card;
      commentText.value = '';
      try {
        const res = await apiFetch(`/api/cards/${card.id}`);
        cardDetail.value = await res.json();
        moveTargetListId.value = cardDetail.value.idList;
      } catch (e) {
        errorMsg.value = 'Failed to load card: ' + e.message;
      }
    }

    async function doMoveCard() {
      if (!moveTargetListId.value || !cardDetail.value) return;
      try {
        await apiFetch(`/api/cards/${cardDetail.value.id}/move`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listId: moveTargetListId.value }),
        });
        await loadBoard();
        await selectCard({ id: cardDetail.value.id });
      } catch (e) {
        errorMsg.value = 'Failed to move card: ' + e.message;
      }
    }

    async function doAddComment() {
      if (!commentText.value.trim() || !cardDetail.value) return;
      try {
        await apiFetch(`/api/cards/${cardDetail.value.id}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: commentText.value }),
        });
        commentText.value = '';
        await selectCard({ id: cardDetail.value.id });
      } catch (e) {
        errorMsg.value = 'Failed to add comment: ' + e.message;
      }
    }

    async function doUpload() {
      const file = fileInput.value?.files?.[0];
      if (!file || !cardDetail.value) return;
      const formData = new FormData();
      formData.append('file', file);
      try {
        await apiFetch(`/api/cards/${cardDetail.value.id}/attachments`, {
          method: 'POST',
          body: formData,
        });
        fileInput.value.value = '';
        await selectCard({ id: cardDetail.value.id });
      } catch (e) {
        errorMsg.value = 'Failed to upload attachment: ' + e.message;
      }
    }

    async function registerWebhook() {
      if (!webhookURL.value || !selectedBoardId.value) return;
      try {
        const res = await apiFetch('/api/webhooks/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callbackURL: webhookURL.value, boardId: selectedBoardId.value }),
        });
        const data = await res.json();
        if (data.id) {
          activeWebhookId.value = data.id;
          savedWebhooks.value[selectedBoardId.value] = {
            webhookId: data.id,
            callbackURL: webhookURL.value,
            boardId: selectedBoardId.value,
          };
          startPolling();
          addToast('Webhook registered successfully', 'success');
        } else {
          errorMsg.value = 'Webhook registration failed: ' + JSON.stringify(data);
        }
      } catch (e) {
        errorMsg.value = 'Failed to register webhook: ' + e.message;
      }
    }

    async function unregisterWebhook() {
      if (!activeWebhookId.value) return;
      try {
        await apiFetch(`/api/webhooks/${activeWebhookId.value}`, { method: 'DELETE' });
        delete savedWebhooks.value[selectedBoardId.value];
        activeWebhookId.value = '';
        addToast('Webhook unregistered', 'info');
      } catch (e) {
        errorMsg.value = 'Failed to unregister webhook: ' + e.message;
      }
    }

    async function pollEvents() {
      try {
        const res = await apiFetch('/api/webhooks/events');
        const data = await res.json();
        if (data.version > lastVersion && lastVersion > 0) {
          // Show toast for new events
          const newEvents = data.events.slice(0, data.version - lastVersion);
          for (const ev of newEvents.slice(0, 3)) {
            let msg = ev.type;
            if (ev.card) msg += ': ' + ev.card;
            if (ev.listAfter) msg += ' → ' + ev.listAfter;
            addToast(msg, 'webhook');
          }
          // Refresh board
          if (selectedBoardId.value) {
            await loadBoard();
            if (cardDetail.value) {
              await selectCard({ id: cardDetail.value.id });
            }
          }
        }
        lastVersion = data.version;
        webhookEvents.value = data.events;
      } catch { /* ignore polling errors */ }
    }

    function startPolling() {
      stopPolling();
      pollEvents();
      pollInterval = setInterval(pollEvents, 3000);
    }

    function stopPolling() {
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    }

    const showEvents = ref(false);

    onMounted(async () => {
      const ok = await checkAuth();
      if (!ok) return;
      await fetchSavedWebhooks();
      await fetchBoards();
      startPolling();
    });

    return {
      boards, selectedBoardId, lists, loading, errorMsg,
      selectedCard, cardDetail, moveTargetListId, commentText, fileInput,
      webhookURL, activeWebhookId, savedWebhooks, webhookEvents,
      loadBoard, selectCard, doMoveCard, doAddComment, doUpload,
      registerWebhook, unregisterWebhook,
      currentUser, logout, toasts, showEvents,
    };
  },
}).mount('#app');
