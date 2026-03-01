# BePirate — Shopify + Trello Workflow Automation

## Context
Full end-to-end system: Shopify order → Trello card → illustrator workflow → client review portal → email notifications → auto-move cards based on client response. Each user maps their Trello board lists to predefined workflow steps. Mailtrap for email testing.

## Workflow Steps (predefined in code, mappable to any Trello list)

| Step Key | Name | Automation |
|---|---|---|
| `orders` | ORDERS | Shopify order creates card here |
| `in_process` | IN PROCESS | Assigned to illustrator, no auto-action |
| `bozza_pronta` | BOZZA PRONTA | Card moved here → email client review link (outline) |
| `in_attesa_outline` | IN ATTESA OUTLINE | Auto-moved here after email sent. Waiting for client. |
| `revisione_outline` | REVISIONE OUTLINE | Auto-moved here if client rejects outline |
| `draft_confirmed` | DRAFT CONFIRMED | Auto-moved here if client approves outline |
| `coloring` | COLORING | Illustrator working on color, no auto-action |
| `colored` | COLORED | Card moved here → email client review link (color) |
| `in_attesa_colore` | IN ATTESA COLORE | Auto-moved here after email sent. Waiting for client. |
| `revisione_colore` | REVISIONE COLORE | Auto-moved here if client rejects color |
| `da_spedire` | DA SPEDIRE | Auto-moved here if client approves color. Ready to ship. |
| `completato` | COMPLETATO | Final, order done |

## Client Review Portal
A public page (no login needed) with a unique token per review request:
- **URL**: `/review.html?token=xxx`
- **Shows**: Order info, submission date, all card attachments (images), comments
- **Client can**: Approve, Reject with suggestions (text), Upload reference screenshots
- **On submit**: Adds comment + attachments to Trello card, auto-moves card to correct list

---

## Steps

### Step 1: Consolidate Serverless Functions (12 → 8, then add new ones)

**Consolidate cards:** Delete `move.js`, `comments.js`, `attachments.js` → create `api/cards/[id]/[action].js`
- Routes by `req.query.action` → move / comments / attachments
- `bodyParser: false` for all (needed for attachments); manual JSON parse for move/comments

**Consolidate webhooks:** Delete `register.js`, `[id].js`, `list.js`, `events.js` → create `api/webhooks/[action].js`
- Routes: register (POST), list (GET), events (GET)
- Fallback: treat action as webhookId for DELETE

Frontend URLs unchanged.

### Step 2: New Trello service functions (`lib/trelloService.js`)
```
createBoard(token, name)                → POST /1/boards (defaultLists=false)
createList(token, boardId, name, pos)   → POST /1/lists
createCard(token, listId, name, desc)   → POST /1/cards
addUrlAttachment(token, cardId, url, name) → POST /1/cards/{cardId}/attachments
```

### Step 3: Extend `lib/store.js`

**Shop→User mapping:**
```
mapShopToUser(shopDomain, email) / getUserForShop(shopDomain) / unmapShopFromUser(shopDomain)
```

**Workflow mapping (per user):**
```
saveWorkflowMapping(email, mapping)  → HSET user:{email} workflowMapping JSON
getWorkflowMapping(email)            → returns { orders: listId, in_process: listId, ... }
```

**Review tokens:**
```
createReviewToken(data)   → SET review:{token} JSON (expires 7d)
getReviewToken(token)     → GET review:{token}
deleteReviewToken(token)  → DEL review:{token}
```

**User hash new fields:** `shopDomain`, `shopifyAccessToken`, `shopifyApiSecret`, `shopifyWebhookId`, `workflowMapping` (JSON), `shopifyOrderBoardId`

### Step 4: Create `lib/shopifyService.js` — NEW
- `verifyWebhookHmac(rawBody, hmacHeader, apiSecret)`
- `registerOrderWebhook(shopDomain, accessToken, callbackUrl)`
- `deleteOrderWebhook(shopDomain, accessToken, webhookId)`
- `formatOrderForTrello(order)` → `{ name, desc }` with full details (items, shipping, totals, etc.)

### Step 5: Create `lib/emailService.js` — NEW (Mailtrap)
- `sendReviewEmail({ to, customerName, orderNumber, reviewUrl, reviewType })`
- reviewType = "outline" or "color"
- Uses Mailtrap SMTP or API
- Email contains: order info, link to review page

### Step 6: Auth handlers (`api/auth/[action].js`) — add new actions

**`setup-board`** (POST) — creates BePirate board + 12 lists, returns board + list IDs
**`workflow-mapping`** (GET/POST) — GET returns current mapping, POST saves list→step mapping
**`connect-shopify`** (POST) — validate Shopify creds, register webhook, save to Redis
**`disconnect-shopify`** (POST) — remove webhook, clear config
**`shopify-config`** (GET) — returns Shopify connection status
Update `handleMe` / `handleLogin` → include `shopifyConnected`, `shopDomain`, `workflowMapping`

### Step 7: Create `api/webhooks/shopify.js` — NEW
- `bodyParser: false`, read raw body for HMAC
- Look up user via `getUserForShop(shopDomain)`
- Verify HMAC
- Format order → `createCard()` on user's mapped `orders` list
- Log event via `addUserEvent()`

### Step 8: Create `api/review/[action].js` — NEW (public, no auth)
Handles the client review portal API:

**`view`** (GET) — look up review token, fetch card details (attachments, comments) from Trello, return data
**`submit`** (POST) — client submits approval/rejection:
  - Parse body (text feedback + file uploads)
  - Add comment to Trello card with client feedback
  - Upload any screenshots as attachments
  - Auto-move card based on response:
    - Approved outline → move to `draft_confirmed` list
    - Rejected outline → move to `revisione_outline` list
    - Approved color → move to `da_spedire` list
    - Rejected color → move to `revisione_colore` list
  - Delete review token (single use)

### Step 9: Webhook automation (`api/webhooks/trello.js`) — MODIFY
When a card move event is detected:
- Look up user's workflow mapping
- If card moved to `bozza_pronta` mapped list:
  - Create review token (type=outline, cardId, userEmail)
  - Send outline review email to client (from card/order data)
  - Auto-move card to `in_attesa_outline` mapped list
- If card moved to `colored` mapped list:
  - Create review token (type=color, cardId, userEmail)
  - Send color review email to client
  - Auto-move card to `in_attesa_colore` mapped list

### Step 10: Frontend — New pages

**`public/review.html`** — Client review portal (public, no login):
- Loads review data via `/api/review/view?token=xxx`
- Shows: order info, submission date, attachments (image gallery), comments
- Approve button / Reject with text area + file upload
- Submits to `/api/review/submit`

### Step 11: Registration flow update (`register.html`)
Step 1: Create account
Step 2: Connect Trello
Step 3: Choose board setup:
  - "Create new BePirate board" (auto-creates with 12 lists, auto-maps)
  - "Use existing board" → select board → map lists to workflow steps
Step 4: Connect Shopify (shop domain, access token, API secret)
Step 5: → Dashboard

### Step 12: Dashboard UI updates (`index.html` + `app.js`)
- Shopify toolbar: connected status, connect/disconnect
- Workflow mapping indicator (show which lists are mapped)
- Settings panel to re-map lists if needed

---

## Final Function Count (10/12)
| # | File | Status |
|---|------|--------|
| 1 | `api/auth/[action].js` | Modified (+setup-board, workflow-mapping, shopify handlers) |
| 2 | `api/boards/index.js` | Unchanged |
| 3 | `api/boards/[id].js` | Unchanged |
| 4 | `api/cards/[id]/index.js` | Unchanged |
| 5 | `api/cards/[id]/[action].js` | NEW (consolidation) |
| 6 | `api/webhooks/[action].js` | NEW (consolidation) |
| 7 | `api/webhooks/trello.js` | Modified (add workflow automations) |
| 8 | `api/webhooks/shopify.js` | NEW |
| 9 | `api/review/[action].js` | NEW (client review portal API) |
| 10 | — | 2 slots free for future use |

## Files to Delete (7)
```
api/cards/[id]/move.js, comments.js, attachments.js
api/webhooks/register.js, [id].js, list.js, events.js
```

## Files to Create (7)
```
api/cards/[id]/[action].js
api/webhooks/[action].js
api/webhooks/shopify.js
api/review/[action].js
lib/shopifyService.js
lib/emailService.js
public/review.html
```

## Files to Modify (7)
```
api/auth/[action].js     — add setup-board, workflow-mapping, shopify handlers
api/webhooks/trello.js   — add workflow automation (email + auto-move on card moves)
lib/trelloService.js     — add createBoard, createList, createCard, addUrlAttachment
lib/store.js             — add shop mapping, workflow mapping, review tokens
public/app.js            — add Shopify + workflow mapping state/methods
public/index.html        — add Shopify toolbar, workflow mapping UI
public/register.html     — new flow: account → trello → board setup/mapping → shopify
```

## New Env Vars
```
MAILTRAP_HOST=sandbox.smtp.mailtrap.io
MAILTRAP_PORT=2525
MAILTRAP_USER=your_mailtrap_user
MAILTRAP_PASS=your_mailtrap_pass
MAILTRAP_FROM=noreply@bepirate.com
```

## Redis Keys (new)
```
shop_user_map              → Hash { shopDomain: email }
review:{token}             → String JSON { token, type, cardId, email, customerEmail, orderNumber, createdAt } (TTL 7d)
```

## Verification
1. Register → Connect Trello → Create board with 12 lists (or map existing)
2. Connect Shopify → webhook registered
3. Shopify order → card created in ORDERS list
4. Move card to BOZZA PRONTA → client gets email with review link
5. Client opens review link → sees attachments, comments
6. Client approves → card moves to DRAFT CONFIRMED, comment added
7. Client rejects with feedback → card moves to REVISIONE OUTLINE, comment + screenshots added
8. Same flow for color review (COLORED → DA SPEDIRE / REVISIONE COLORE)
9. All events show as toasts on dashboard
10. `vercel --prod` deploys with 10 functions
