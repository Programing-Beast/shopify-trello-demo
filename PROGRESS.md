# BePirate — Progress Tracker

## Project Overview
BePirate is a Trello-based workflow automation tool for illustrators. It connects Shopify orders to Trello boards, automates the illustration review process with clients, and manages the full order lifecycle from intake to delivery.

**Stack:** Node.js, Vercel Serverless, Upstash Redis, Vue 3 (CDN), Mailtrap (email)

---

## What Has Been Done

### Phase 1: Multi-User Auth + Trello OAuth (COMPLETED)

**New files created:**
- `lib/auth.js` — JWT sign/verify/authenticate middleware (7-day expiry)
- `api/auth/[action].js` — Catch-all auth handler with 6 actions:
  - `register` (POST) — create account, hash password (bcryptjs), return JWT
  - `login` (POST) — verify credentials, return JWT
  - `me` (GET) — current user profile (protected)
  - `connect-trello` (POST) — save/validate Trello OAuth token (protected)
  - `avatar` (POST) — upload avatar as base64 (protected)
  - `config` (GET) — return trelloApiKey + appUrl (public)
- `public/login.html` — email/password login form
- `public/register.html` — 3-step registration: account → connect Trello → select boards
- `public/auth-callback.html` — captures `#token=xxx` from Trello OAuth redirect

**Modified files:**
- `package.json` — added `bcryptjs`, `jsonwebtoken`
- `vercel.json` — added `Authorization` to CORS allowed headers
- `.env` / `.env.example` — added `JWT_SECRET`
- `lib/trelloConfig.js` — removed hardcoded `token` (keeps only `key` + `baseURL`)
- `lib/trelloService.js` — `token` added as 1st param to ALL functions
- `lib/store.js` — full rewrite: user CRUD, user-scoped events/webhooks, board→user mapping
- `api/boards/index.js`, `api/boards/[id].js` — auth guard + token passthrough
- `api/cards/[id]/index.js`, `move.js`, `comments.js`, `attachments.js` — auth guard + token passthrough
- `api/webhooks/register.js` — auth + `mapBoardToUser()`
- `api/webhooks/[id].js` — auth + `unmapBoardFromUser()`
- `api/webhooks/list.js`, `events.js` — auth + user-scoped data
- `api/webhooks/trello.js` — board→user routing with error handling
- `public/index.html` — user info/logout in header, toast notifications, collapsible events
- `public/app.js` — `apiFetch()` wrapper with Bearer token, auth guard, toasts

**Current Redis key structure:**
```
user:{email}                → Hash { email, password, name, avatar, trelloToken, boards, createdAt }
users:index                 → Set of emails
webhook_events:{email}      → List (max 100)
board_version:{email}       → Counter
registered_webhooks:{email} → Hash { boardId: JSON }
board_user_map              → Hash { boardId: email }
```

**Current serverless function count: 12/12 (Vercel Hobby limit)**
```
api/auth/[action].js
api/boards/index.js
api/boards/[id].js
api/cards/[id]/index.js
api/cards/[id]/move.js
api/cards/[id]/comments.js
api/cards/[id]/attachments.js
api/webhooks/register.js
api/webhooks/[id].js
api/webhooks/list.js
api/webhooks/events.js
api/webhooks/trello.js
```

**Environment variables configured (local + Vercel):**
- `TRELLO_API_KEY`, `APP_URL`, `WEBHOOK_URL`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `JWT_SECRET`

---

## What Needs To Be Done

### Phase 2: Shopify + Trello Workflow Automation (NEXT)

See `plan.md` for full details. Summary:

1. **Consolidate serverless functions** (12 → 8) to free slots
2. **Add Trello board/list creation** functions
3. **Shopify integration** — webhook receives orders, creates Trello cards
4. **Workflow mapping** — user maps their lists to predefined workflow steps
5. **Client review portal** — public page where clients approve/reject artwork
6. **Email notifications** — Mailtrap for sending review links to clients
7. **Auto-move cards** — based on client approval/rejection responses
8. **Registration flow update** — board setup + Shopify connect during onboarding
9. **Dashboard updates** — Shopify status, workflow mapping UI

---

## Architecture Overview

```
Shopify Store
  └─ webhook (orders/create) ─→ /api/webhooks/shopify.js
                                    └─ creates Trello card in ORDERS list

Illustrator (Dashboard)
  └─ moves card to BOZZA PRONTA / COLORED
        └─ /api/webhooks/trello.js detects move
              ├─ sends review email to client (Mailtrap)
              └─ auto-moves card to IN ATTESA list

Client (Review Portal)
  └─ /review.html?token=xxx
        ├─ views attachments + comments
        ├─ approves → card moves to DRAFT CONFIRMED / DA SPEDIRE
        └─ rejects → card moves to REVISIONE list + adds feedback

Dashboard (Vue 3)
  └─ polls /api/webhooks/events every 3s
        └─ shows toast notifications, refreshes board
```
