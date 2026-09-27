# GhostChat

[![CI](https://github.com/MrtnOmwenga/GhostChat/actions/workflows/ci.yml/badge.svg)](https://github.com/MrtnOmwenga/GhostChat/actions/workflows/ci.yml)

End-to-end encrypted chat with disposable accounts. Sign up with a username and a password, no
email or personal details; talk directly or in invite-only rooms. Your browser encrypts and signs
every message, and the server stores and relays ciphertext it cannot read, forge or silently
alter.

React (Vite, Redux Toolkit) · libsodium · Node.js (Express 5, Socket.IO) · MongoDB · Redis · Docker

**Design:** [docs/DESIGN.md](docs/DESIGN.md) (threat model, key management, message format,
phases).

## Run it

```sh
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
docker compose up --build        # or: podman-compose up --build
```

Open http://localhost:5000, create two accounts in two browser windows (one private), search for
the other user and start chatting.

## What it does

- **End-to-end encrypted messages.** Each message is encrypted in the sender's browser
  (XChaCha20-Poly1305), signed with their Ed25519 key, and linked by hash to the message before it.
  The server checks signature and link before storing; the recipient's browser checks them again
  and decrypts.
- **Keys you control, on any device.** Keys are derived from a 24-word recovery phrase and kept
  in a vault encrypted with a key derived from your password (Argon2id). The server stores the
  vault but never receives the password. Signing in on a new device restores the vault; a
  forgotten password is recovered with the phrase.
- **Invite-only rooms.** Each room has its own key, replaced whenever someone leaves. Invite
  links carry their secret after the `#`, which browsers never send to the server; new members
  read the room's whole history. Members can compare a key fingerprint shown in the header.
- **Automatic conflict handling.** When two people send at the same instant, the one who loses
  the race rebases onto the winner's message and resends, without the user noticing.
- **Encrypted photos and files.** Attach, paste or drop a file (up to 10 MB). The browser
  encrypts it with a fresh key (libsodium `secretstream`) before uploading; the server stores the
  ciphertext in MongoDB's GridFS, so there is no separate storage service to run or pay for.
  Photos are re-encoded first, which shrinks them and strips metadata such as GPS position, and
  carry a small encrypted thumbnail. The signed message names the file by the hash of its
  ciphertext, and the recipient's browser checks the download against it.
- **Emoji, previews, presence, history.** An emoji picker (served from GhostChat itself, not a
  CDN), large emoji-only messages, multi-line messages, previews decrypted in the browser,
  online status across tabs, and history that survives a reload.
- **See it for yourself.** A shield on every message shows whether its signature and chain link
  verify; a Verify drawer shows the hashes, signature and raw envelope; a Chain view draws the
  conversation as linked blocks. `npm run tamper` edits a stored message the way a compromised
  server could, and the UI flags exactly that message.
- **Verifiable identity.** Keys can be rotated (the recovery phrase proves the new key was
  committed to in advance, so a stolen key can't take over an identity) or reset if the phrase
  is lost. Contacts see which it was, compare 60-digit safety numbers, and mark each other
  verified; a later unauthorised key change raises a warning.
- **Key transparency log.** Every key ever published goes into an append-only Merkle tree whose
  heads the server signs. Browsers check that the keys they use are in it and that it only ever
  grew; once a day its root is timestamped on Bitcoin through OpenTimestamps. A Transparency page
  shows it all, down to the inclusion proof for your own keys.
- **Signed read receipts**, off by default and reciprocal: only people who turn them on send them
  and see other people's.
- **Deletion that means it.** Deleting a message, or a whole account, is a statement the author
  signs; the content and any files are erased and a signed marker keeps the chain verifiable.

## Design

```
Browser (libsodium)                         Server
───────────────────                         ──────
password ─Argon2id─► authKey ──────────────► bcrypt(authKey)      (never the password)
                 └─► vaultKey ─ opens ─────► encrypted vault      (private keys)
recovery phrase ─► every key version
                                            key history           (signed, per user)
message ─encrypt─sign─link─► envelope ─────► checks signature, sender, chain link
                                            MongoDB: ciphertext only (files in GridFS)
                                            Socket.IO (+ Redis adapter) relays envelopes
```

The built frontend is served by the same server as the API and the WebSocket, so everything is
one origin and the session cookie never crosses sites.

### Security model

- **Content:** only conversation participants can decrypt. End-to-end tests run real
  conversations and then scan the whole database, stored files included, for the sent text and
  file contents: they are never there.
- **Integrity:** messages are signed and hash-chained; the server rejects forged or misaddressed
  envelopes, and clients verify every signature against the sender's key history, which must be
  in the transparency log. Envelopes carry the sender's view of the log, so two people shown
  different logs notice.
- **Passwords:** never leave the browser. Argon2id (64 MiB, 3 passes) splits each password into
  a login key and a vault key; sign-up requires a strong password (zxcvbn score 3 or higher),
  because the vault is only as strong as the password protecting it.
- **Sessions:** HS256 JWTs (12 h) in an `httpOnly`, `SameSite=Strict` cookie; the WebSocket is
  authenticated from the same cookie during the handshake.
- **Abuse:** rate limits on sign-in, recovery, the API and messages per connection; strict CSP
  (WebAssembly is allowed for libsodium, JavaScript `eval` is not).

**Limits, stated plainly** (details in [DESIGN.md §11](docs/DESIGN.md#11-limitations)):

- No forward secrecy yet: a leaked private key exposes messages sent to it. Planned (Double
  Ratchet / MLS).
- The server still sees metadata: who talks to whom, when, and message and file sizes.
- Like every web app, the server delivers the code that does the encryption.
- Deleting an account keeps its public key history (username and public keys): the transparency
  log is append-only, and it's what lets others keep verifying old signatures.
- Signatures prove authorship to anyone (no deniability): GhostChat chooses verifiability.
- Safety numbers use a simplified construction (a single hash, not Signal's iterated one).

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
cd backend && npm test            # API, sockets and verification, against an in-memory MongoDB
cd frontend && npm test           # crypto module (published test vectors) and state
cd e2e && npm install && npx playwright install chromium && npm test   # the whole app in a browser
```

- **Crypto tests** check the implementation against RFC 8032 (Ed25519), RFC 7748 (X25519),
  FIPS 180-2 (SHA-256) and BIP-39 reference vectors. Canonical-JSON vectors and a key-history
  fixture are shared by the frontend and backend suites, so the two implementations can't drift.
- **Backend tests** cover chain conflicts, forged and tampered envelopes, key-history rules,
  recovery challenges, room rotation, invites, tombstones, and file access, quotas and cleanup.
- **End-to-end tests** (Playwright) cover sign-up with the recovery phrase, weak passwords,
  sign-in on a new device with no password on the wire, unlocking after storage is cleared,
  password change, recovery, encrypted DMs and rooms, invite links, key rotation after someone
  leaves, the emoji picker, photos and files (metadata stripped, downloads decrypted, outsiders
  refused, files deleted with their message, new room members seeing earlier files), that the
  database holds no plaintext, message, file and log tampering being flagged, key rotation and
  reset as contacts see them, safety numbers, and read receipts.
- **Tampering tests** edit the server's database directly to play a compromised server. A
  worker option gives them servers of their own, so they can't corrupt what other tests see.

**Parallel and isolated.** Each Playwright worker starts its own server with its own in-memory
MongoDB; Jest runs suites in parallel the same way; CI splits the end-to-end suite into two
shards. Password hashing uses lower costs in tests only (`BCRYPT_ROUNDS`).

**Flaky tests are surfaced, not hidden.** CI retries a failed test once to tell flaky from broken,
then fails the run anyway if it only passed on retry (`failOnFlakyTests`). A weekly
[flake hunt](.github/workflows/flake-hunt.yml) runs every test 10 times with no retries.

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
| `LOG_SIGNING_KEY` | derived from `JWT_SECRET` | 64 hex characters; the transparency log's Ed25519 seed |
| `ANCHORING` | `on` in production | daily OpenTimestamps anchoring of the log |
| `OTS_CALENDARS` | two public calendars | comma-separated |
| `FILE_MAX_MB` | `10` | largest attachment |
| `FILE_QUOTA_MB` | `200` | stored attachments per user |

### API

| | |
|---|---|
| `GET /api/auth/salt` · `POST /api/auth/register`, `/login`, `/logout`, `/password`, `/recovery` · `GET /api/auth/me`, `/vault`, `/recovery/challenge` | accounts |
| `GET /api/users/search?q=` · `GET /api/users/:id/keys` · `DELETE /api/users/me` | users and key histories |
| `GET /api/rooms/mine`, `/:id` · `POST /api/rooms`, `/:id/invites`, `/:id/rotate`, `/:id/leave` · `DELETE /api/rooms/:id` | rooms |
| `GET /api/invites/:id` · `POST /api/invites/:id/accept` | invites |
| `GET /api/messages?conversation=` · `GET /api/messages/conversations`, `/receipts` · `POST /api/messages/delete` | encrypted history, receipts, signed deletions |
| `POST /api/files?conversation=` (encrypted bytes) · `GET /api/files/:id` | attachments, participants only |
| `POST /api/keys/rotate`, `/reset` · `PATCH /api/users/me/settings` | key changes, settings |
| `GET /api/log/key`, `/head`, `/head/:size`, `/consistency`, `/entries`, `/users/:id`, `/anchors`, `/anchors/:id.ots` | transparency log (mostly public) |

Socket events: `message` (a signed envelope → `ok`, `conflict` with the missed messages,
`rotation-needed`, or `error`), `receipt`, `presence`, `room` (membership and key changes),
`keys-changed`.

## License

[MIT](LICENSE)
