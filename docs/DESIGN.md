# GhostChat security design

End-to-end encryption, verifiable identity and tamper-evident history for a web chat app.
Author: Martin Omwenga.

GhostChat's server relays and stores data it cannot read, cannot forge and cannot silently
alter, and each of those guarantees is visible and checkable in the UI. This document describes
how, what it defends against, and where its limits are.

**Contents:** [Goals](#1-goals-and-non-goals) · [Threat model](#2-threat-model) ·
[Primitives](#3-primitives) · [Accounts and keys](#4-accounts-passwords-and-the-key-vault) ·
[Identity and key transparency](#5-identity-key-history-and-key-transparency) ·
[Messages](#6-messages) · [Rooms](#7-rooms) · [Attachments](#8-attachments-and-emoji) ·
[In the UI](#9-how-the-guarantees-appear-in-the-ui) · [Limitations](#10-limitations) ·
[Rejected alternatives](#11-considered-and-rejected) · [Testing](#12-testing) ·
[Next](#13-next)

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
5. All of the above is visible in the product: verification shields, a chain view, key history, a
   transparency log page, safety numbers.
6. "Vanish without a trace": deleting a message or an account really removes the content.

**Non-goals** (see [Limitations](#10-limitations))

- Forward secrecy and post-compromise security (Double Ratchet / MLS): the next step.
- Hiding metadata (who talks to whom, when): the server still sees it.
- Per-device keys and device revocation: one keyset per account, synced through an encrypted
  vault.
- Storing anything on a public blockchain.

## 2. Threat model

| Actor | Can | Must not be able to |
|---|---|---|
| **Server operator / compromised server** | See metadata (sender, recipient or room, time, size); refuse service; serve the web app | Read content; forge or alter messages; swap keys undetected; reorder or silently drop history |
| **Database leak** | Everything stored | Read content, private keys or passwords |
| **Network attacker** | Observe TLS traffic | Anything beyond metadata visible at the network level |
| **Other users** | Read conversations they belong to | Read others' conversations; post as someone else; read a room after leaving it |
| **Stolen unlocked device** | Everything that user can do | (out of scope; the user rotates keys from another device) |

Trusted: the user's browser and the JavaScript it runs. A malicious server could serve modified
JavaScript that exfiltrates keys; this is the standing weakness of web end-to-end encryption and
is addressed only partially ([§10](#10-limitations)).

## 3. Primitives

All cryptography comes from **libsodium** (`libsodium-wrappers-sumo`) and WebCrypto; nothing is
hand-rolled.

| Purpose | Primitive |
|---|---|
| Password to keys | Argon2id (64 MiB, 3 passes) |
| Signing identity | Ed25519 |
| Encryption keys | X25519 |
| Message encryption | XChaCha20-Poly1305 (AEAD) |
| File encryption | `secretstream` (XChaCha20-Poly1305, chunked) |
| Key wrapping | `crypto_box_seal` (X25519 + XSalsa20-Poly1305) |
| Hashes, chain links, Merkle tree | SHA-256 (RFC 6962 domain separation for the tree) |
| Canonical encoding before hashing and signing | JSON Canonicalization Scheme (RFC 8785) |
| Recovery phrase | BIP-39, 24 words |
| Identity format | W3C `did:key` (Ed25519 public key, multicodec) |

## 4. Accounts, passwords and the key vault

If the browser sent the password to the server, and encryption keys were derived from it, the
server could derive them too. So the browser splits the password first:

```
salt      = server-provided per user (a deterministic HMAC-derived fake salt for unknown usernames,
            so the endpoint doesn't reveal which usernames exist)
master    = Argon2id(password, salt) -> 64 bytes
authKey   = master[0:32]   -> sent to the server, which stores bcrypt(authKey)
vaultKey  = master[32:64]  -> never leaves the browser
```

The **vault** is the user's private keys encrypted with `vaultKey` (XChaCha20-Poly1305) and
stored on the server. Signing in on a new device downloads the vault and unlocks it locally, so
history and identity follow the user without the server ever holding a usable key. Changing the
password re-encrypts the vault.

**Recovery phrase (mandatory).** A 24-word BIP-39 phrase generated at sign-up; the user confirms
it by re-entering three randomly chosen words before the account is created. **Every key the
account will ever use is derived from it**: key version *n* is
`seed_keypair(BLAKE2b(key = BIP-39 seed, "ghostchat/signing/n"))`, and likewise for encryption.
So the phrase alone can regenerate an account's keys, and it is what makes pre-rotation work
([§5.2](#52-key-history-sigchain-with-pre-rotation)). The vault holds the current signing key
and *every* encryption key the account has had, so history stays readable after rotations
without the phrase.

**Strong passwords.** The vault is only as strong as the password protecting it: whoever holds the
database can guess passwords against it offline. Sign-up and password changes therefore require a
zxcvbn score of at least 3 ("safely unguessable"), and Argon2id runs with 64 MiB of memory and 3
passes (heavy enough to slow guessing, light enough for a phone). The check can only run in the
browser, since the server never sees the password; a modified client could skip it, which would
weaken only that user's own vault. The recovery phrase (256 bits) is not guessable.

### 4.1 Devices and recovery

| Situation | What happens |
|---|---|
| **New device** | Username and password → the browser derives `authKey` (signs in) and `vaultKey` → downloads the vault and unlocks it locally → full history is readable at once |
| **Browser storage cleared, device lost** | Nothing is lost: the browser only caches keys; the vault is on the server |
| **Password forgotten** | Username and recovery phrase → the browser regenerates the current keys from the phrase, proves possession by signing a single-use server challenge, and sets a new password (new salt, `authKey` and vault) |
| **Password and phrase both lost** | History cannot be recovered by anyone, including the server. The user can reset: new keys (a *reset* entry in the key history), and contacts see a warning |
| **Device compromised** | Rotate keys from a trusted device (asks for the phrase); contacts see "rotated, signed by previous key ✓" |

Unlocked keys are held in memory, with a copy in IndexedDB encrypted under a non-extractable
AES-GCM key: page scripts can use that key but can't read its bytes.

### 4.2 Sessions

Signing in creates a session: a row on the server, named by a signed token in an httpOnly,
SameSite=Strict cookie. The signature stops anyone inventing a session. The row is what lets one
be ended:

| Event | Sessions ended |
|---|---|
| **Sign out** | That one. A copy of its cookie stops working at once, and its open sockets are closed |
| **Password changed** | Every other session of that user |
| **Account recovered with the phrase** | Every session of that user, then a new one for the browser that recovered it |
| **Account deleted** | Every session of that user |

Each session's sockets share a channel, so ending it closes them on whichever server instance
they are connected to. Expired rows are removed by a MongoDB TTL index.

## 5. Identity, key history and key transparency

### 5.1 Identity

A user's identity is their first Ed25519 key, expressed as a `did:key`. Usernames are display
handles bound to the identity through the transparency log, which is why they can't be changed (a
rename would need its own signed log entry). Using a standard DID format means a
decentralised-identity sign-in could plug straight in later.

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

- **Rotation** creates version *n+1*, signed by the version *n* key. Contacts see "keys rotated:
  signed by their previous key ✓".
- **Pre-rotation** (from KERI): each entry commits to the hash of the *next* signing key, which is
  derived from the recovery phrase and never stored in the vault. An attacker who steals the
  current key cannot rotate to a key of their own, because it won't match the commitment. Rotation
  therefore asks for the recovery phrase.
- **Reset** (all keys lost): a new entry not signed by the previous key, flagged as a reset.
  Contacts see a warning and are prompted to compare safety numbers.

The server checks every entry against the same rules before accepting it, and every client checks
the whole history again before using a key.

### 5.3 Key transparency log

Every key-history entry is also appended to a server-wide **Merkle tree log** (RFC 6962, the
Certificate Transparency design; WhatsApp shipped the same idea in 2023):

- Leaf: `sha256(0x00 ‖ JCS(username, key-history entry))`.
- The server signs each **tree head** `{size, rootHash, timestamp}` with a log key that browsers
  pin on first use.
- When a client fetches anyone's keys it also checks an **inclusion proof** for them, and a
  **consistency proof** from the last tree head it saw. A server that shows different users
  different keys, or rewrites the log, fails these proofs.
- Clients attach their latest tree head to messages, so two users who chat also cross-check that
  they see the same log (split-view detection).
- **Anchoring:** once a day the root is timestamped on the Bitcoin blockchain through
  OpenTimestamps (free, no tokens). This is the one place a real blockchain adds value:
  independent, third-party proof that the log wasn't rewritten after the fact. The transparency
  page lists each anchored root, and the proof can be downloaded and checked with the standard
  `ots verify` client. GhostChat parses and verifies the OpenTimestamps format with its own small
  implementation, because the reference JavaScript library carries known-vulnerable dependencies.

### 5.4 Safety numbers

For any contact: a 60-digit number and QR code derived from both users' identity keys, to compare
in person or on a call. Marking a contact verified pins their key; any later change without a
valid signature from the pinned key raises a warning.

The marks follow the account to its other devices. They are kept on the server as one encrypted
blob, sealed in the browser with a key derived from the oldest encryption key in the vault: every
device that has unlocked the vault can open it, it survives rotations, and the server can neither
read the marks nor invent one. Each write names the version it was based on, so two devices
changing the marks at once can't drop each other's change. What the server can still do is serve
an older copy; that can remove a recent mark or bring back a removed one, never create one.

## 6. Messages

### 6.1 Envelope

```json
{
  "conversation": "dm:<userA>:<userB> | room:<roomId>",
  "seq": 42,
  "prev": "sha256 of envelope 41",
  "sender": "<userId>", "senderKeyVersion": 3,
  "ciphertext": "…", "nonce": "…",
  "keys": { "<userId>": "content key sealed to that user" },
  "attachments": [{ "id": "sha256 of the encrypted file", "size": 123 }],
  "logHead": "the sender's latest signed tree head",
  "createdAt": "…",
  "hash": "sha256(JCS(all fields above))",
  "signature": "Ed25519(hash) by the sender"
}
```

- **Direct messages:** a random content key per message, sealed to the recipient *and* to the
  sender (so the sender can read their own history on another device).
- **Room messages:** encrypted under the room's current epoch key ([§7](#7-rooms)); `keys` is
  absent.
- The conversation ID is bound into the encryption as associated data, so a ciphertext can't be
  moved to another conversation.
- The sender's name isn't stored with the message; clients resolve it from the sender's signed
  key history.

**Nobody can post as someone else.** The server accepts an envelope only if its sender is the
signed-in user, it is signed with that user's current key, and the signature verifies. Every
recipient checks the signature again against the sender's key history, which must itself be in
the transparency log. The server never holds a private key, so it cannot forge messages either.

### 6.2 Hash chain and ordering

Each conversation is a single hash chain. The server enforces it: a message is accepted only if
its `prev` equals the current head. Because the signature covers `seq` and `prev`, the server
cannot reorder or splice messages, and a client that sees a gap or a broken link flags it.

**Simultaneous sends are resolved automatically.** When two people send at the same moment, the
server accepts one and answers the other with a conflict carrying the messages it missed. The
sender's browser then, without any user action: applies the message that won, re-links its own
message onto it, re-signs, and resends, with a short jittered backoff. The message shows as
*sending* until it lands, and both people see the same order. A test sends from both sides at
once, repeatedly, and always ends with one intact chain.

### 6.3 Deletion without breaking the chain

Deleting a message replaces it with a **tombstone** that keeps `seq`, `prev`, `hash` and a
deletion statement signed by the author; the ciphertext, keys and any attached file are erased.
The chain still verifies, the content is gone, and the UI shows "Message deleted" rather than a
silent gap. Deleting an account signs one statement covering all of the user's messages.

### 6.4 Read receipts

A receipt is a signed statement "*reader* has read *conversation* up to `seq`", stored as the
latest receipt per reader. Receipts are **off by default** because they reveal activity, and
reciprocal: a user who turns them on sends receipts and sees other people's. When on, they work
fully: ticks per message, updated live, verified signatures.

### 6.5 Sidebar previews

The conversations endpoint returns each conversation's latest envelope; the browser decrypts it
for the preview line. The server never sees the preview text.

## 7. Rooms

- A room has a random 128-bit **room ID**; its name is only a display name. The header shows a
  fingerprint of the current room key, which members can compare.
- **Invite links:** `https://…/join/<inviteId>#<inviteSecret>`. The part after `#` is never sent to
  the server. The invite record holds every epoch key of the room, encrypted under a key derived
  from the secret, which is how a joiner gets the full history. Invites expire and can be limited
  in uses. Replacing the room key cancels outstanding invites, so an invite never carries
  out-of-date keys.
- **Epochs:** the room key is replaced when a member leaves or deletes their account. The server
  refuses new messages for the room until the replacement is done, so a departed member can't read
  anything new; the next member to send generates the new key, seals it to each remaining member,
  and then sends, without user action.
- Creations, joins, leaves and key changes are signed events in the room's chain, so they appear
  in the conversation and in the chain view.

## 8. Attachments and emoji

**Files and images**

- Encrypted in the browser with a random per-file key (`secretstream`: 64 KiB chunks, each
  authenticated, the last tagged final, so a reordered, altered or truncated file fails to
  decrypt), then uploaded and stored **by the SHA-256 of the ciphertext** in MongoDB's GridFS.
  GridFS needs no storage service beyond the database GhostChat already runs, so there is nothing
  extra to host or pay for; the storage module is small enough to swap for S3-compatible storage
  if files outgrow the database.
- The envelope lists only each file's ID and size, which the server needs to check access, apply
  quotas and delete the file with its message. The file key, name, type, dimensions and thumbnail
  are inside the encrypted payload. Because the envelope is signed, the recipient checks the
  downloaded bytes against the hash the sender signed before decrypting.
- The server accepts an upload only from a participant of the conversation, and an envelope only
  if the files it lists were uploaded by its sender into that conversation, with those sizes.
  Downloads go only to current participants (a new room member gets the room's earlier files; a
  member who left gets none). Limits: 10 MB per file and 200 MB per user, both configurable.
- Images are re-encoded in the browser (at most 2048 px, WebP or JPEG), which shrinks them and
  strips EXIF metadata such as GPS position and camera model. A thumbnail of at most 12 KB travels
  inside the encrypted payload, so a preview shows before the full image downloads. Animated GIFs
  are kept as they are.
- Only PNG, JPEG, WebP and GIF are shown inline. Anything else, SVG and HTML included, is offered
  as a download and never rendered, because decrypted files are shown from GhostChat's own origin.
- A file is deleted when its message is deleted, with the account that sent it, or after an hour
  if no message ever referred to it (an abandoned upload).

**Emoji**: a picker served by GhostChat itself (no CDN) and loaded only when opened; messages that
are only emoji render larger.

## 9. How the guarantees appear in the UI

| Surface | Shows |
|---|---|
| **Shield on each message** | Signature and chain link verified, or what failed |
| **Verify drawer** (click a shield) | Hash, previous hash, chain link, signature, sender key version, attachment hash, read receipts, raw envelope |
| **Chain view** (per conversation) | Messages as linked blocks from the genesis hash; tombstones; room events; a broken link in red |
| **My keys** | Your `did:key`, key fingerprints, key history with reasons, rotate and reset |
| **Contact keys** | Their key history, "signed by previous key ✓" or reset warning, safety number and QR, mark as verified |
| **Transparency page** | Current signed tree head, your inclusion proof drawn as a path to the root, consistency with what this browser saw before, Bitcoin anchors |
| **Room header** | Key fingerprint and epoch, invite links |
| **Tamper demo** (`npm run tamper -- <conversation> <seq> [content\|link]`, local databases only) | Edits one stored message the way a compromised server could; the UI flags exactly that message |

## 10. Limitations

- **No forward secrecy.** A leaked encryption key exposes past messages encrypted to it. Key
  rotation limits the window; the Double Ratchet for direct messages and MLS for rooms would
  remove it.
- **Metadata is visible to the server.** Who talks to whom and when, message and file sizes, and
  room membership.
- **Files already downloaded stay downloaded.** A member who leaves a room, like anyone who read a
  message, keeps what their browser already decrypted; they just can't fetch anything more.
- **Web delivery.** The server serves the code that does the encryption, so a server that turned
  hostile could serve code that leaks keys. A strict CSP limits what the page can load. What can
  be done about the rest is to make *which code was published* a public fact:
  - The client build is reproducible. Its files and their hashes are listed in `bundle.json`, and
    one digest over the list names the build. The release builds the client twice, in the image
    and outside it, and stops if the two differ.
  - The release signs the image into Sigstore's public log with that digest attached, under the
    identity of this repository's release workflow. The server doesn't control that log.
  - The transparency page re-fetches every file, compares it with the list, and gives the
    command that checks the digest against the public record.

  This makes a change detectable by anyone who looks from outside. It doesn't make each browser
  check before running the code: a page can't verify the server that sent the page. That needs
  something the server didn't send, such as a browser extension, and is not built.
- **Account deletion keeps public keys.** Messages, files, the vault and private keys are erased,
  but the username and public keys stay in the transparency log, which is append-only by design.
- **The log is recomputed per request.** Fine for a small deployment; a large one would cache
  interior nodes.
- **Signatures are non-repudiable.** A signed message proves authorship to anyone. Signal chooses
  deniability instead; GhostChat chooses verifiability, since tamper evidence is the point.
- **One keyset per account.** All devices share keys through the vault; there is no per-device
  revocation.
- **Safety numbers use a simplified construction** (a single hash, not Signal's iterated one).
- **The server can refuse service** (drop messages outright or block users). Clients detect gaps in
  chains they can see, but cannot force delivery.

## 11. Considered and rejected

- **Messages on a public blockchain.** Permanent and public: incompatible with deletion, exposes
  the social graph to everyone, and adds fees and latency for no gain over a verifiable log.
- **IPFS for attachments.** Content addressing is kept (files are stored by hash), but IPFS makes
  anything published retrievable by anyone with the address and practically impossible to delete
  once replicated, which breaks "vanish without a trace". It also adds a node to operate.
- **Separate object storage (MinIO / S3).** The original plan for attachments. GridFS gives the
  same guarantees for files of this size without another service to run or pay for.
- **Per-device Signal sessions.** Correct for forward secrecy, but multi-device session management
  would double the scope; it belongs with the forward-secrecy work.
- **Custom cryptography.** Only libsodium primitives and published constructions.

## 12. Testing

- **Crypto unit tests** against published vectors: RFC 8032 (Ed25519), RFC 7748 (X25519), FIPS
  180-2 (SHA-256) and BIP-39. Canonical-JSON vectors, a key-history fixture and Merkle proofs are
  shared by the frontend and backend suites, so the two implementations can't drift. File
  encryption is tested for round trips and for altered, truncated and extended files.
- **Backend tests** (in-memory MongoDB): chain conflicts and a concurrent-send stress test,
  forged and misaddressed envelopes, key-history rules, recovery challenges, room rotation,
  invites, tombstones, receipts, the transparency log and OpenTimestamps parsing, and file access,
  quotas and cleanup.
- **End-to-end tests** (Playwright, each worker with its own server and database):
  - after real conversations, the database and stored files contain **no plaintext** (scanned for
    the sent text and file contents, and for the metadata a photo carried);
  - tampering with a stored message, a stored file or the log is flagged exactly where it
    happened;
  - key rotation shows "signed by previous key", a reset shows the warning;
  - a member who leaves can't read what comes next, and a new member sees the whole history;
  - invite secrets never reach the server;
  - sign-in on a new device, recovery with the phrase, read receipts, and deletion.
- **Flaky tests are surfaced, not hidden:** CI fails a run whose tests only pass on retry, and a
  weekly job runs the whole suite 10 times with no retries.

## 13. Next

- **Forward secrecy:** the Double Ratchet for direct messages and MLS for rooms.
- **Sealed sender,** to hide who sent a message from the server.
- **Emoji reactions** as signed chain events.
