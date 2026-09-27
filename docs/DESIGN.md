# GhostChat v3 design: end-to-end encryption, verifiable identity, tamper-evident history

Status: **draft for review** · Author: Martin Omwenga · Last updated: 2026-09-27

GhostChat today (v2) authenticates every request and socket, but the server stores message text in
plain form and is trusted completely. v3 removes that trust: the server relays and stores data it
cannot read, cannot forge, and cannot silently alter, and every one of those guarantees is visible
and checkable in the UI.

## 1. Goals and non-goals

**Goals**

1. Message content, room keys and attachments are readable only by the conversation's
   participants. A database dump contains ciphertext only.
2. Every message is signed by its author and linked into a hash chain, so the server cannot forge,
   edit, reorder, drop or insert messages without clients detecting it.
3. The server cannot substitute a user's public key (to intercept a conversation) without
   detection: keys are published in an append-only, verifiable key transparency log.
4. Users can see and rotate their keys; contacts can verify that a new key was authorised by the
   old one.
5. All of the above is visible in the product: verification badges, a chain view, key history, a
   transparency log page, safety numbers.
6. Keep "vanish without a trace": deleting a message or an account really removes the content.

**Non-goals for v3** (see [Limitations](#11-limitations))

- Forward secrecy and post-compromise security (Double Ratchet / MLS): planned as v4.
- Hiding metadata (who talks to whom, when): the server still sees it.
- Per-device keys and device revocation: v3 has one keyset per account, synced through an
  encrypted vault.
- Storing anything on a public blockchain.

## 2. Threat model

| Actor | Can | Must not be able to |
|---|---|---|
| **Server operator / compromised server** | See metadata (sender, recipient or room, time, size); refuse service; serve the web app | Read content; forge or alter messages; swap keys undetected; reorder or silently drop history |
| **Database leak** | Everything stored | Read content, private keys or passwords |
| **Network attacker** | Observe TLS traffic | Anything beyond metadata visible at the network level |
| **Other users** | Read conversations they belong to | Read others' conversations; post as someone else; stay in a room after being removed |
| **Stolen unlocked device** | Everything that user can do | (out of scope; the user rotates keys from another device) |

Trusted: the user's browser and the JavaScript it runs. A malicious server could serve modified
JavaScript that exfiltrates keys; this is the standing weakness of web E2EE and is addressed only
partially (§11).

## 3. Primitives

All cryptography comes from **libsodium** (`libsodium-wrappers-sumo`) and WebCrypto; nothing is
hand-rolled.

| Purpose | Primitive |
|---|---|
| Password to keys | Argon2id (`crypto_pwhash`, moderate limits) |
| Signing identity | Ed25519 |
| Encryption keys | X25519 |
| Message and file encryption | XChaCha20-Poly1305 (AEAD); `secretstream` for files |
| Key wrapping | `crypto_box_seal` (X25519 + XSalsa20-Poly1305) |
| Hashes, chain links, Merkle tree | SHA-256 (RFC 6962 domain separation for the tree) |
| Canonical encoding before hashing and signing | JSON Canonicalization Scheme (RFC 8785) |
| Identity format | W3C `did:key` (Ed25519 public key, multicodec) |

## 4. Accounts, passwords and the key vault

Today the browser sends the password to the server. If encryption keys were derived from it, the
server could derive them too. v3 splits the password in the browser:

```
salt      = server-provided per user (a deterministic HMAC-derived fake salt for unknown usernames,
            so the endpoint doesn't reveal which usernames exist)
master    = Argon2id(password, salt) -> 64 bytes
authKey   = master[0:32]   -> sent to the server, which bcrypts it as it bcrypts passwords today
vaultKey  = master[32:64]  -> never leaves the browser
```

The **vault** is the user's private keys encrypted with `vaultKey` (XChaCha20-Poly1305) and
stored on the server. Signing in on a new device downloads the vault and unlocks it locally, so
history and identity follow the user without the server ever holding a usable key. Changing the
password re-encrypts the vault.

**Recovery phrase (optional).** A 24-word BIP-39 mnemonic generated at sign-up. It derives a
second copy of the vault key and seeds the pre-rotation keys (§5.2). Losing both the password and
the phrase means losing the account's history: by design, nobody can recover it.

Unlocked keys live in memory and IndexedDB as non-extractable where WebCrypto allows.

## 5. Identity, key history and key transparency

### 5.1 Identity

A user's identity is their first Ed25519 key, expressed as a `did:key`. Usernames remain as
display handles bound to the identity through the transparency log. Using `did:key` costs nothing
now and lets a future decentralised-identity sign-in (a separate project) plug straight in.

### 5.2 Key history (sigchain) with pre-rotation

Every change to a user's keys is an entry in their **key history**, an append-only signed chain:

```json
{
  "user": "did:key:z6Mk…",
  "version": 3,
  "signingKey": "ed25519:…",
  "encryptionKey": "x25519:…",
  "nextKeyCommitment": "sha256(signing key for version 4)",
  "reason": "suspected compromise",
  "prev": "sha256(entry v2)",
  "createdAt": "2026-10-20T09:12:00Z",
  "signature": "ed25519 signature by the version 2 signing key"
}
```

- **Rotation** creates version *n+1*, signed by the version *n* key. Contacts see "leo rotated keys
  on 20 Oct: signed by their previous key ✓".
- **Pre-rotation** (from KERI): each entry commits to the hash of the *next* signing key, which is
  derived from the recovery phrase and never stored in the vault. An attacker who steals the
  current key cannot rotate to a key of their own, because it won't match the commitment. Without
  a recovery phrase, pre-rotation is unavailable and the UI says so.
- **Reset** (all keys lost): a new entry not signed by the previous key, flagged as a reset.
  Contacts see a warning and are prompted to compare safety numbers.

### 5.3 Key transparency log

Every key-history entry is also appended to a server-wide **Merkle tree log** (RFC 6962, the
Certificate Transparency design; WhatsApp shipped the same idea in 2023):

- Leaf: `sha256(0x00 ‖ JCS(username, key-history entry))`.
- The server signs each **tree head** `{size, rootHash, timestamp}` with a published log key.
- When a client fetches anyone's keys it also fetches an **inclusion proof** for them, and a
  **consistency proof** from the last tree head it saw (kept in IndexedDB). A server that shows
  different users different keys, or rewrites the log, fails these proofs.
- Clients attach the hash of their latest tree head to messages, so two users who chat also
  cross-check that they see the same log (split-view detection).
- **Optional anchoring:** once a day the root is timestamped on a public blockchain through
  OpenTimestamps (free, no tokens). This is the one place a real chain adds value: independent
  proof that the log wasn't rewritten after the fact.

### 5.4 Safety numbers

For any contact: a 60-digit number and QR code derived from both users' current identity keys,
to compare in person. Marking a contact verified pins their key; any later change without a valid
signature from the pinned key raises a warning.

## 6. Messages

### 6.1 Envelope

```json
{
  "conversation": "dm:<userA>:<userB> | room:<roomId>",
  "seq": 42,
  "prev": "sha256 of envelope 41",
  "sender": "did:key:…", "senderKeyVersion": 3,
  "ciphertext": "…", "nonce": "…",
  "keys": { "<userId>": "content key sealed to that user" },
  "attachments": [{ "cid": "sha256:…", "size": 123, "key": "…", "mime": "image/png" }],
  "logHead": "sha256 of the sender's latest tree head",
  "createdAt": "…",
  "hash": "sha256(JCS(all fields above))",
  "signature": "Ed25519(hash) by the sender"
}
```

- **Direct messages:** a random content key per message, sealed to the recipient *and* to the
  sender (so the sender can read their own history on another device).
- **Room messages:** encrypted under the room's current epoch key (§7); `keys` is empty.
- The sender's name is no longer stored with the message; clients resolve it from the sender's
  identity.

### 6.2 Hash chain and ordering

Each conversation is a single hash chain. The server enforces it: a message is accepted only if
its `prev` equals the current head. If two people send at the same moment, one gets `409 Conflict`
with the new head, re-links and re-signs, and resends (like a rejected `git push`). Because the
signature covers `seq` and `prev`, the server cannot reorder or splice messages, and a client that
sees a gap or a broken link flags it.

### 6.3 Deletion without breaking the chain

Deleting a message replaces it with a **tombstone** that keeps `seq`, `prev`, `hash` and a
deletion record signed by the author (or by the account-deletion request); the ciphertext and keys
are erased. The chain still verifies, the content is gone, and the UI shows "message deleted by
leo" rather than a silent gap. Account deletion writes one signed deletion record covering all of
the user's messages.

### 6.4 Read receipts

A receipt is a signed statement "*reader* has read *conversation* up to `seq` / `hash`", stored as
the latest receipt per reader. The UI shows ticks; the Verify drawer shows the signed receipt.
Receipts are **off by default** and can be enabled per user: they reveal activity, and this is an
anonymity-first app.

### 6.5 Sidebar previews

The conversations endpoint returns each conversation's latest envelope; the browser decrypts it
for the preview line, timestamp and unread count. The server never sees the preview text.

## 7. Rooms

- A room has a random 128-bit **room ID**; its name becomes a display name and no longer needs to
  be unique. Rooms are shown as `Night Owls · 7F3A-91C2`, the suffix being a fingerprint of the
  current room key, which all members can compare.
- **Invite links:** `https://…/join/<roomId>#<inviteSecret>`. The part after `#` is never sent to
  the server; it decrypts the room key for the joiner. An invite can be single-use or expiring, and
  a room password can be required as a second factor.
- **Epochs:** the room key is replaced when a member leaves, is removed, or deletes their account.
  The member making the change (or, if they left, the next member to come online) generates the
  new key and seals it to each remaining member. The server refuses new messages for the room
  until the pending rotation is done, so a departed member can't read anything new.
- Joins, leaves, removals and epoch changes are signed events in the room's chain, so they appear
  in the chain view.
- History for new members: off by default (they see messages from their join onward); a room can
  opt in to sharing earlier epochs' keys with new members.

## 8. Attachments and emoji

**Files and images**

- Encrypted in the browser with a random per-file key (`secretstream`, chunked, so large files
  never sit whole in memory) and stored **by the hash of their ciphertext** in S3-compatible
  storage: MinIO in Docker Compose, Amazon S3 in production.
- The message envelope carries the hash, size, MIME type and file key; the server stores an
  object it can't read.
- Downloads go through short-lived pre-signed URLs issued only to conversation participants. Size
  limits are enforced server-side; type checks happen client-side (the server can't see content).
- Images get a small thumbnail generated in the browser before encryption and embedded
  (encrypted) in the envelope, so a preview shows before the full image downloads.
- An object is deleted when the last message referencing it is deleted.

**Emoji**: an emoji picker loaded only when opened, and messages that are only emoji (up to
three) rendered larger. Emoji reactions, as signed chain events, are a candidate for later.

## 9. How the guarantees appear in the UI

| Surface | Shows |
|---|---|
| **Shield on each message** | ✓ signature and chain link verified · ⚠ failed (explains why) |
| **Verify drawer** (click a message) | Hash, previous hash, signature, sender key version, receipt signatures |
| **Chain view** (per conversation) | Messages as linked blocks; tombstones; membership and epoch events; a broken link in red |
| **Profile → Keys** | Your `did:key`, current fingerprints, key history with reasons, "rotate keys", recovery phrase status |
| **Contact → Keys** | Their key history, "signed by previous key ✓" or reset warning, safety number and QR, verify toggle |
| **Transparency page** | Current tree head, your inclusion proof drawn as a path to the root, last consistency check, optional blockchain timestamp |
| **Room header** | Key fingerprint, epoch, invite link controls |
| **Tamper demo** (`npm run tamper -- <messageId>`, local only) | Edits one stored message; the UI flags exactly which link broke |

## 10. Changes by layer

**Server**: salt and `authKey` login; vault storage; key-history and transparency-log endpoints
(append, inclusion and consistency proofs, signed tree heads); envelope storage with chain
enforcement (`409` on a stale `prev`); tombstones; receipts; rooms by ID with epochs and sealed
keys; invite records; pre-signed URLs for MinIO/S3; OpenTimestamps job. The server verifies
signatures on write too, so malformed or forged envelopes are rejected early; clients still verify
everything themselves.

**Client**: a `crypto/` module (libsodium, key derivation, vault, envelopes, chain and Merkle
verification) with no UI dependencies; the feature-folder restructure deferred from v2
(`features/auth`, `features/chat`, `features/rooms`, `features/keys`, `features/transparency`,
shared `ui/`); the UI surfaces in §9.

**Infrastructure**: MinIO in Compose; the log's signing key supplied like `JWT_SECRET`.

## 11. Limitations

- **No forward secrecy in v3.** A leaked encryption key exposes past messages encrypted to it.
  Key rotation limits the window; v4 replaces static keys with the Double Ratchet for direct
  messages and MLS for rooms.
- **Metadata is visible to the server.** Who talks to whom and when, message sizes, and room
  membership. Sealed sender is a later option.
- **Web delivery.** The server serves the code that does the encryption. Mitigations: Subresource
  Integrity, reproducible builds with published bundle hashes, and a strict CSP. A browser
  extension that checks the bundle hash (as Meta's Code Verify does) or a packaged desktop app
  would close more of the gap.
- **Signatures are non-repudiable.** A signed message proves authorship to anyone. Signal chooses
  deniability instead; GhostChat chooses verifiability, since tamper evidence is the point.
- **One keyset per account.** All devices share keys through the vault; there is no per-device
  revocation.
- **The server can refuse service** (drop messages outright or block users). Clients detect gaps in
  chains they can see, but cannot force delivery.

## 12. Considered and rejected

- **Messages on a public blockchain.** Permanent and public: incompatible with deletion, exposes
  the social graph to everyone, and adds fees and latency for no gain over a verifiable log.
- **IPFS for attachments.** Content addressing is kept (files are stored by hash), but IPFS itself
  makes anything published retrievable by anyone with the address and practically impossible to
  delete once replicated, which breaks "vanish without a trace". It also adds a node to operate.
  The storage layer is an interface, so an IPFS backend remains possible where permanence is wanted.
- **Per-device Signal sessions in v3.** Correct for forward secrecy, but multi-device session
  management would double the scope; v4.
- **Custom cryptography.** Only libsodium primitives and published constructions.

## 13. Testing

- Unit tests for the `crypto/` module against published test vectors (Argon2id, Ed25519, RFC 6962
  Merkle proofs, RFC 8785 canonicalisation).
- Property-based tests for chain and log verification: random histories with random tampering
  must always be detected.
- Backend tests: chain enforcement (`409`), tombstones, epoch rotation blocking sends, pre-signed
  URL authorisation, signature checks on write.
- End-to-end (existing Playwright setup, parallel isolated servers):
  - after a full conversation with attachments, the database and object store contain **no
    plaintext** (scanned for the sent strings and file bytes);
  - the tamper script makes the UI flag the exact broken message;
  - key rotation shows "signed by previous key", a reset shows the warning;
  - a removed room member can't decrypt messages sent after the rotation;
  - invite links work and the secret never reaches server logs.

## 14. Phases

| Phase | Scope | Estimate |
|---|---|---|
| **A** | Password split and vault, keys, encrypted and signed DMs, rooms by ID with epochs and invite links, sidebar previews, emoji, frontend restructure | ~4 days |
| **B** | Hash chains with tombstones, shield/Verify drawer/chain view, read receipts, key history with rotation and pre-rotation, transparency log and page, safety numbers, tamper demo | ~3–4 days |
| **C** | Encrypted attachments and image thumbnails in MinIO/S3 | ~1.5 days |
| **v4** | Double Ratchet (DMs) and MLS (rooms); sealed sender | later |

## 15. Open questions

1. Recovery phrase: offered at sign-up (skippable), or required?
2. Room history for new members: off by default (current choice), or chosen per room at creation?
3. Read receipts off by default (current choice): agreed?
4. OpenTimestamps anchoring in phase B, or later?
