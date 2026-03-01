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

    async function fetchBoards() {
      try {
        const res = await fetch('/api/boards');
        boards.value = await res.json();
      } catch (e) {
        errorMsg.value = 'Failed to load boards: ' + e.message;
      }
    }

    async function fetchSavedWebhooks() {
      try {
        const res = await fetch('/api/webhooks/list');
        savedWebhooks.value = await res.json();
      } catch { /* ignore */ }
    }

    async function loadBoard() {
      if (!selectedBoardId.value) { lists.value = []; return; }
      loading.value = true;
      errorMsg.value = '';
      try {
        const res = await fetch(`/api/boards/${selectedBoardId.value}`);
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
        const res = await fetch(`/api/cards/${card.id}`);
        cardDetail.value = await res.json();
        moveTargetListId.value = cardDetail.value.idList;
      } catch (e) {
        errorMsg.value = 'Failed to load card: ' + e.message;
      }
    }

    async function doMoveCard() {
      if (!moveTargetListId.value || !cardDetail.value) return;
      try {
        await fetch(`/api/cards/${cardDetail.value.id}/move`, {
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
        await fetch(`/api/cards/${cardDetail.value.id}/comments`, {
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
        await fetch(`/api/cards/${cardDetail.value.id}/attachments`, {
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
        const res = await fetch('/api/webhooks/register', {
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
        await fetch(`/api/webhooks/${activeWebhookId.value}`, { method: 'DELETE' });
        delete savedWebhooks.value[selectedBoardId.value];
        activeWebhookId.value = '';
      } catch (e) {
        errorMsg.value = 'Failed to unregister webhook: ' + e.message;
      }
    }

    async function pollEvents() {
      try {
        const res = await fetch('/api/webhooks/events');
        const data = await res.json();
        webhookEvents.value = data.events;
        if (data.version > lastVersion) {
          lastVersion = data.version;
          if (selectedBoardId.value) {
            await loadBoard();
            if (cardDetail.value) {
              await selectCard({ id: cardDetail.value.id });
            }
          }
        }
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

    onMounted(async () => {
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
    };
  },
}).mount('#app');
