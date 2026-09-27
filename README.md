# GhostChat

[![CI](https://github.com/MrtnOmwenga/GhostChat/actions/workflows/ci.yml/badge.svg)](https://github.com/MrtnOmwenga/GhostChat/actions/workflows/ci.yml)

Real-time chat with disposable accounts: sign up with just a username and password (no email,
no personal details), message people directly or in password-protected rooms, and delete the
account when you're done.

React (Vite, Redux Toolkit) · Node.js (Express 5, Socket.IO) · MongoDB · Redis · Docker

## Run it

```sh
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
docker compose up --build        # or: podman-compose up --build
```

Open http://localhost:5000, create two accounts in two browser windows (one private), search for
the other user and start chatting.

## Features

- **Direct messages and rooms.** Rooms have a name and a password; the creator can delete them (API).
  Members see "<name> joined the room" when someone new joins.
- **History that survives a reload.** Messages are stored and the last 100 of a conversation load
  when it's opened.
- **Presence.** Contacts show as online while they have at least one tab open.
- **Several server instances.** With Redis configured, Socket.IO events are relayed between
  instances (Redis adapter) and presence counts are shared.

## Design

```
Browser ── HTTPS ──► Express API ──────────► MongoDB (users, rooms, messages)
   │                    │
   └──── WebSocket ───► Socket.IO ◄────────► Redis (presence, cross-instance events)
```

The built frontend is served by the same server as the API and the WebSocket, so everything is
one origin and the session cookie never crosses sites. In development, Vite proxies `/api` and
`/socket.io` to the backend to keep that true.

### Security model

- **Sessions** are signed JWTs (HS256, 12 h) in an `httpOnly`, `SameSite=Strict` cookie: page
  scripts can't read them, and other sites can't send them, which removes the need for a CSRF
  token. The server won't start with a `JWT_SECRET` shorter than 32 characters.
- **The WebSocket is authenticated during the handshake** from the same cookie. The sender of a
  message always comes from the session, never from the payload, so nobody can post as someone
  else. Room membership is checked on every message.
- **Accounts can only be changed by their owner.** There are no `/users/:id` write routes;
  updates and deletion go through `/users/me`.
- **Passwords** are bcrypt-hashed (cost 12) and never leave the server; API responses are built
  from explicit field lists. Login compares against a dummy hash for unknown usernames, so timing
  doesn't reveal which usernames exist.
- **Input** is validated with Joi at every boundary (REST bodies, query strings, socket
  payloads); usernames and searches are restricted to `[A-Za-z0-9 _-]`, so no regex or query
  operators reach MongoDB.
- **Rate limits:** 10 login/registration attempts per IP per 15 minutes, 300 API requests per IP
  per 15 minutes, 20 messages per connection per 10 seconds.
- **Headers:** Helmet's defaults (CSP, HSTS, frame and MIME protections); CORS limited to
  configured origins.

**Not end-to-end encrypted.** The server stores message text and could read it; transport
encryption comes from TLS in front of the app. End-to-end encryption is the next planned step.

## Development

```sh
# backend (needs MongoDB; Redis optional)
cd backend
cp .env.example .env              # set JWT_SECRET
npm install
npm run dev                       # http://localhost:5000

# frontend
cd frontend
npm install
npm run dev                       # http://localhost:5173, proxies to the backend
```

Tests:

```sh
cd backend && npm test            # API + Socket.IO, against an in-memory MongoDB
cd frontend && npm test           # chat state logic
cd e2e && npm install && npx playwright install chromium && npm test   # the whole app in a browser
```

The end-to-end suite (Playwright) starts the real server with the built frontend and an
in-memory MongoDB, then drives it in Chromium: sign-up and sign-in, live direct messages between
two browsers, unread markers and presence, history after a reload, rooms and join
announcements, account deletion, the phone layout, and that no page scrolls sideways on a phone.

The backend suite covers authentication and session tampering, that no response contains a
password hash, users only being able to change themselves, room permissions, sender spoofing,
unauthenticated sockets, message delivery and storage, multi-tab presence, and rate limits.

### Configuration

| Variable | Default | |
|---|---|---|
| `JWT_SECRET` | (required) | 32+ characters |
| `MONGODB_URI` | `mongodb://localhost:27017/ghostchat` | |
| `REDIS_URL` | unset | enables shared presence and the Socket.IO Redis adapter |
| `CORS_ORIGINS` | `http://localhost:5173` | comma-separated |
| `SESSION_HOURS` | `12` | |
| `SECURE_COOKIES` | `true` in production | set `false` only for plain-HTTP local runs |
| `STATIC_DIR` | unset | serve the built frontend from this folder |

### API

| | |
|---|---|
| `POST /api/auth/register`, `/login`, `/logout`; `GET /api/auth/me` | session |
| `GET /api/users/search?q=` · `PATCH /api/users/me` · `DELETE /api/users/me` | users |
| `GET /api/rooms/mine` · `POST /api/rooms` · `POST /api/rooms/join` · `DELETE /api/rooms/:id` | rooms |
| `GET /api/messages?with=<userId>` or `?room=<roomId>` · `GET /api/messages/conversations` | history |

Socket events: `message` ({ to \| room, text } → ack with the stored message), `presence`
(user ids → ack with those online; pushed on change), `announcement`.

## License

[MIT](LICENSE)
