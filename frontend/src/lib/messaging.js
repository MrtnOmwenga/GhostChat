/*
 * The client side of GhostChat's end-to-end encryption (docs/DESIGN.md §5–7). Everything here
 * runs in the browser: envelopes are verified and decrypted as they arrive, and encrypted and
 * signed before they leave. Key material stays in this module and the key store, never in Redux.
 */
import api from './api';
import store from '../app/store';
import { currentKeys } from './keystore';
import { emitWithAck } from './socket';
import { checkUserInLog, currentHead, checkPeerHead } from './log';
import {
  sodium as loadSodium, verifyHistory, dmConversation, genesisHash, encryptPayload, decryptPayload,
  sealKey, openSealed, signEnvelope, verifyEnvelope, keyFingerprint, fromB64, toB64, utf8, signObject, verifyObject,
} from './crypto';
import {
  contactUpserted, contactRemoved, recordsReceived, pendingAdded, pendingRemoved, conversationOpened, receiptReceived, keysChanged,
} from '../features/chat/chatSlice';

let me = null;
const histories = new Map(); // userId -> Promise<verified key history>
const roomKeys = new Map(); // roomId -> Map(epoch -> key bytes)
const rooms = new Map(); // roomId -> room as returned by the API
const names = new Map(); // userId -> username
const loaded = new Set(); // conversations whose history has been fetched
const receiptSent = new Map(); // conversation -> highest seq I've sent a receipt for

export function startMessaging(user) {
  me = user;
  names.set(user.id, user.username);
}

export function stopMessaging() {
  me = null;
  [histories, roomKeys, rooms, names, loaded, receiptSent].forEach((m) => m.clear());
}

const myKeys = () => currentKeys();
const myVersion = () => myKeys().signing.version;
const myEncryption = (version) => myKeys().encryption[version];
const roomIdOf = (conversation) => conversation.slice(5);
const peerOf = (conversation) => conversation.slice(3).split(':').find((id) => id !== me.id);

/** A user's verified key history; refetched when an envelope names a newer key version. */
export async function keysOf(userId, { minVersion = 0 } = {}) {
  const cached = histories.get(userId);
  if (cached) {
    const history = await cached.catch(() => null);
    if (history && history.current.version >= minVersion) return history;
  }
  const request = (async () => {
    const sodium = await loadSodium();
    const { data: entries } = await api.get(`/users/${userId}/keys`);
    const history = verifyHistory(sodium, entries);
    // A key history the transparency log doesn't vouch for could be one the server made up.
    const log = await checkUserInLog(userId, entries).catch(() => ({ problems: ['the transparency log could not be checked'], paths: [] }));
    const problems = [...history.problems, ...log.problems];
    return {
      ...history, ok: problems.length === 0, problems, entries, logPaths: log.paths, logHead: log.head,
    };
  })();
  histories.set(userId, request);
  return request;
}

async function payloadKey(sodium, env) {
  if (env.conversation.startsWith('room:')) {
    const key = roomKeys.get(roomIdOf(env.conversation))?.get(env.epoch);
    if (!key) throw new Error(`no room key for epoch ${env.epoch}`);
    return key;
  }
  const sealed = env.keys?.[me.id];
  const mine = sealed && myEncryption(sealed.keyVersion);
  if (!mine) throw new Error('not addressed to this account');
  return openSealed(sodium, sealed.sealed, mine.publicKey, mine.privateKey);
}

const EVENT_TEXT = {
  created: (name) => `${name} created the room`,
  joined: (name) => `${name} joined the room`,
  left: (name) => `${name} left the room`,
  rotated: (name) => `${name} replaced the room key`,
};

/** Verifies and decrypts one envelope into a record for the store. */
async function toRecord(sodium, env, previous) {
  const expectedPrev = env.seq === 1 ? genesisHash(sodium, env.conversation) : previous?.hash;
  const link = expectedPrev === undefined ? null : env.prev === expectedPrev;
  const base = {
    hash: env.hash,
    seq: env.seq,
    prev: env.prev,
    sender: env.sender,
    senderName: names.get(env.sender) || 'deleted account',
    senderKeyVersion: env.senderKeyVersion,
    epoch: env.epoch,
    createdAt: env.createdAt,
    envelope: env,
  };
  if (!names.has(env.sender)) {
    // Someone no longer in any shared room, or a deleted account: the key history still names them.
    const history = await keysOf(env.sender).catch(() => null);
    const name = history?.entries?.[0]?.username;
    if (name) {
      names.set(env.sender, name);
      base.senderName = name;
    }
  }
  if (env.deleted) return { ...base, kind: 'deleted', deleted: env.deleted, verification: await verifyDeletion(sodium, env, link) };

  // A broken link is listed first: it says where in the chain things went wrong.
  const problems = link === false ? ['does not link to the previous message'] : [];
  let signature = false;
  try {
    const history = await keysOf(env.sender, { minVersion: env.senderKeyVersion });
    if (!history.ok) problems.push(...history.problems);
    const signingKey = history.entries[env.senderKeyVersion - 1]?.signingKey;
    const check = verifyEnvelope(sodium, env, signingKey);
    if (!check.hashOk) problems.push('content does not match its hash');
    else if (!check.signatureOk) problems.push('signature does not match the sender\'s key');
    signature = check.hashOk && check.signatureOk && history.ok;
  } catch {
    problems.push("the sender's keys are unavailable");
  }
  const splitView = await checkPeerHead(env.logHead).catch(() => null);
  if (splitView) {
    problems.push(splitView);
    signature = false;
  }

  try {
    const payload = decryptPayload(sodium, await payloadKey(sodium, env), env);
    const verification = { signature, link, problems };
    if (payload.type === 'event') {
      const text = (EVENT_TEXT[payload.event] || (() => ''))(base.senderName);
      return { ...base, kind: 'event', event: payload.event, text, previewText: text, verification };
    }
    return { ...base, kind: 'text', text: payload.text, verification };
  } catch (error) {
    return { ...base, kind: 'unreadable', previewText: 'Message could not be decrypted', verification: { signature, link, problems: [...problems, error.message] } };
  }
}

/**
 * A tombstone is only as good as its deletion signature: it must be signed by the message's
 * author and name this exact message (or the whole account).
 */
async function verifyDeletion(sodium, env, link) {
  const d = env.deleted;
  const problems = [];
  let signature = false;
  try {
    const history = await keysOf(env.sender, { minVersion: d.keyVersion });
    const names = d.type === 'account-deleted' || (d.conversation === env.conversation && d.seq === env.seq && d.hash === env.hash);
    if (d.user !== env.sender) problems.push('deleted by someone other than the author');
    if (!names) problems.push('the deletion names a different message');
    if (!verifyObject(sodium, d, history.entries[d.keyVersion - 1]?.signingKey)) problems.push('deletion signature does not match');
    signature = problems.length === 0;
  } catch {
    problems.push("the author's keys are unavailable");
  }
  if (link === false) problems.push('does not link to the previous message');
  return { signature, link, problems, deletion: true };
}

/** Verifies, decrypts and stores envelopes of one conversation, in chain order. */
export async function processEnvelopes(conversation, envelopes, { live = false } = {}) {
  if (!envelopes.length) return;
  const sodium = await loadSodium();
  const existing = store.getState().chat.messages[conversation] || [];
  const bySeq = new Map(existing.map((r) => [r.seq, r]));
  const records = [];
  for (const env of [...envelopes].sort((a, b) => a.seq - b.seq)) {
    // eslint-disable-next-line no-await-in-loop
    const record = await toRecord(sodium, env, bySeq.get(env.seq - 1));
    bySeq.set(env.seq, record);
    records.push(record);
  }
  store.dispatch(recordsReceived({ conversation, records, meId: me.id, live }));
  if (live) markRead(conversation);
}

export async function loadHistory(conversation) {
  const { data } = await api.get('/messages', { params: { conversation } });
  loaded.add(conversation);
  await processEnvelopes(conversation, data);
}

/** Loads the whole chain (up to 2000 messages) so every link back to the first can be checked. */
export async function loadFullChain(conversation) {
  const { data } = await api.get('/messages', { params: { conversation, after: 0, limit: 2000 } });
  loaded.add(conversation);
  await processEnvelopes(conversation, data);
}

/** A live envelope from the socket; fills any gap first so every link can be checked. */
export async function receiveLive(env) {
  const conversation = env.conversation;
  if (conversation.startsWith('dm:') && !store.getState().chat.contacts[conversation]) {
    // A first message from someone new: their name comes from their signed key history.
    const peer = peerOf(conversation);
    const history = await keysOf(peer).catch(() => null);
    const name = history?.entries?.[0]?.username || 'unknown';
    names.set(peer, name);
    store.dispatch(contactUpserted({ conversation, kind: 'user', id: peer, name }));
  }
  const records = store.getState().chat.messages[conversation] || [];
  const lastSeq = records.length ? records[records.length - 1].seq : 0;
  if (loaded.has(conversation) && env.seq > lastSeq + 1) {
    const { data } = await api.get('/messages', { params: { conversation, after: lastSeq } });
    await processEnvelopes(conversation, data, { live: true });
    return;
  }
  await processEnvelopes(conversation, [env], { live: true });
}

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function buildEnvelope(sodium, conversation, payload) {
  const records = store.getState().chat.messages[conversation] || [];
  const head = records.length ? records[records.length - 1] : { seq: 0, hash: genesisHash(sodium, conversation) };
  const body = {
    v: 1,
    conversation,
    seq: head.seq + 1,
    prev: head.hash,
    sender: me.id,
    senderKeyVersion: myVersion(),
    createdAt: new Date().toISOString(),
  };
  if (currentHead()) body.logHead = currentHead();
  if (conversation.startsWith('room:')) {
    const room = rooms.get(roomIdOf(conversation));
    body.epoch = room.epoch;
    Object.assign(body, encryptPayload(sodium, roomKeys.get(room.id).get(room.epoch), payload, conversation));
  } else {
    const peer = peerOf(conversation);
    const peerKeys = await keysOf(peer);
    if (!peerKeys.ok) throw new Error(`${names.get(peer) || 'This user'}'s keys don't verify; not sending`);
    const contentKey = sodium.randombytes_buf(32);
    Object.assign(body, encryptPayload(sodium, contentKey, payload, conversation));
    body.keys = {
      [peer]: { keyVersion: peerKeys.current.version, sealed: sealKey(sodium, contentKey, peerKeys.current.encryptionKey) },
      [me.id]: { keyVersion: myVersion(), sealed: sealKey(sodium, contentKey, myEncryption(myVersion()).publicKey) },
    };
  }
  return signEnvelope(sodium, body, fromB64(sodium, myKeys().signing.privateKey));
}

/**
 * Sends a payload, resolving conflicts without the user: if someone else's message landed first,
 * the server returns what we missed; we apply it, re-link onto the new head, re-sign and resend
 * (docs/DESIGN.md §6.2). A room whose key must be replaced first is rotated here too.
 */
async function sendPayload(conversation, payload) {
  const sodium = await loadSodium();
  if (!loaded.has(conversation)) await loadHistory(conversation);
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const env = await buildEnvelope(sodium, conversation, payload);
    // eslint-disable-next-line no-await-in-loop
    const reply = await emitWithAck('message', env);
    if (reply.status === 'ok') {
      // eslint-disable-next-line no-await-in-loop
      await processEnvelopes(conversation, [reply.envelope], { live: true });
      return;
    }
    if (reply.status === 'conflict') {
      // eslint-disable-next-line no-await-in-loop
      await processEnvelopes(conversation, reply.missing, { live: true });
      // eslint-disable-next-line no-await-in-loop
      await sleep(Math.random() * 40 * attempt);
    } else if (reply.status === 'rotation-needed') {
      // eslint-disable-next-line no-await-in-loop
      await rotateRoom(roomIdOf(conversation));
    } else {
      throw new Error(reply.error || 'Could not send the message');
    }
  }
  throw new Error('The conversation is very busy; try again');
}

export async function sendText(conversation, text) {
  const tempId = `${Date.now()}-${Math.random()}`;
  store.dispatch(pendingAdded({ conversation, tempId, text }));
  try {
    await sendPayload(conversation, { type: 'text', text });
  } finally {
    store.dispatch(pendingRemoved({ conversation, tempId }));
  }
}

const sendEvent = (conversation, event) => sendPayload(conversation, { type: 'event', event }).catch(() => {});

async function signDeletion(fields) {
  const sodium = await loadSodium();
  const body = {
    user: me.id, at: new Date().toISOString(), keyVersion: myVersion(), ...fields,
  };
  return signObject(sodium, body, fromB64(sodium, myKeys().signing.privateKey));
}

/** Deletes one of my messages: a signed statement; the server erases the content. */
export async function deleteMessage(conversation, seq) {
  const record = (store.getState().chat.messages[conversation] || []).find((r) => r.seq === seq);
  if (!record || record.sender !== me.id) throw new Error('You can only delete your own messages');
  const deletion = await signDeletion({
    type: 'delete', conversation, seq, hash: record.hash,
  });
  const { data } = await api.post('/messages/delete', { deletion });
  await processEnvelopes(conversation, [data]);
}

/** The signed request that deletes the account and tombstones every message it sent. */
export const accountDeletion = () => signDeletion({ type: 'account-deleted' });

export async function openConversation(conversation) {
  store.dispatch(conversationOpened(conversation));
  if (!loaded.has(conversation)) await loadHistory(conversation);
  await loadReceipts(conversation).catch(() => {});
  markRead(conversation);
}

export function startDirectChat(user) {
  names.set(user.id, user.username);
  const conversation = dmConversation(me.id, user.id);
  store.dispatch(contactUpserted({ conversation, kind: 'user', id: user.id, name: user.username }));
  return openConversation(conversation);
}

/** DMs with their latest envelope (decrypted here into a preview) and every room. */
export async function loadConversations() {
  const [{ data: list }, { data: myRooms }] = await Promise.all([api.get('/messages/conversations'), api.get('/rooms/mine')]);
  for (const room of myRooms) {
    // eslint-disable-next-line no-await-in-loop
    await rememberRoom(room);
  }
  for (const item of list) {
    if (item.peer) {
      names.set(item.peer.id, item.peer.username);
      store.dispatch(contactUpserted({ conversation: item.conversation, kind: 'user', id: item.peer.id, name: item.peer.username }));
    }
    // eslint-disable-next-line no-await-in-loop
    if (store.getState().chat.contacts[item.conversation]) await processEnvelopes(item.conversation, [item.last]);
  }
}

// ---- rooms -----------------------------------------------------------------------------------

async function rememberRoom(room) {
  const sodium = await loadSodium();
  rooms.set(room.id, room);
  room.members.forEach((m) => names.set(m.id, m.username));
  const keys = roomKeys.get(room.id) || new Map();
  room.keys.forEach((k) => {
    const mine = myEncryption(k.keyVersion);
    if (mine && !keys.has(k.epoch)) keys.set(k.epoch, openSealed(sodium, k.sealed, mine.publicKey, mine.privateKey));
  });
  roomKeys.set(room.id, keys);
  const current = keys.get(room.epoch);
  store.dispatch(contactUpserted({
    conversation: `room:${room.id}`,
    kind: 'room',
    id: room.id,
    name: room.name,
    epoch: room.epoch,
    fingerprint: current ? keyFingerprint(sodium, current) : null,
    members: room.members,
    creator: room.creator,
  }));
}

export async function refreshRoom(roomId) {
  try {
    const { data } = await api.get(`/rooms/${roomId}`);
    await rememberRoom(data);
  } catch (error) {
    if (error.status === 404) {
      rooms.delete(roomId);
      roomKeys.delete(roomId);
      store.dispatch(contactRemoved(`room:${roomId}`));
    }
  }
}

export async function createRoom(name) {
  const sodium = await loadSodium();
  const key = sodium.randombytes_buf(32);
  const version = myVersion();
  const { data } = await api.post('/rooms', {
    name, key: { keyVersion: version, sealed: sealKey(sodium, key, myEncryption(version).publicKey) },
  });
  await rememberRoom(data);
  const conversation = `room:${data.id}`;
  await openConversation(conversation);
  await sendEvent(conversation, 'created');
  return conversation;
}

const inviteKey = (sodium, secret) => sodium.crypto_generichash(32, secret, utf8('ghostchat/invite'));
const inviteAd = (roomId, epoch) => utf8(`ghostchat/invite/${roomId}/${epoch}`);

/**
 * An invite link carries its secret after the '#', which browsers never send to the server. The
 * server stores every epoch key of the room encrypted under a key derived from that secret.
 */
export async function createInvite(roomId, { singleUse = false } = {}) {
  const sodium = await loadSodium();
  const secret = sodium.randombytes_buf(32);
  const wrap = inviteKey(sodium, secret);
  const keys = [...roomKeys.get(roomId).entries()].sort(([a], [b]) => a - b).map(([epoch, key]) => {
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(key, inviteAd(roomId, epoch), null, nonce, wrap);
    return { epoch, nonce: toB64(sodium, nonce), ciphertext: toB64(sodium, ciphertext) };
  });
  const { data } = await api.post(`/rooms/${roomId}/invites`, { keys, singleUse });
  return { link: `${window.location.origin}/join/${data.id}#${toB64(sodium, secret)}`, expiresAt: data.expiresAt };
}

export async function acceptInvite(inviteId, secretB64) {
  const sodium = await loadSodium();
  const { data } = await api.get(`/invites/${inviteId}`);
  const wrap = inviteKey(sodium, fromB64(sodium, secretB64));
  const version = myVersion();
  let keys;
  try {
    keys = data.keys.map((k) => {
      const key = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null, fromB64(sodium, k.ciphertext), inviteAd(data.room.id, k.epoch), fromB64(sodium, k.nonce), wrap,
      );
      return { epoch: k.epoch, keyVersion: version, sealed: sealKey(sodium, key, myEncryption(version).publicKey) };
    });
  } catch {
    throw new Error('This invite link is incomplete or has been altered');
  }
  const { data: room } = await api.post(`/invites/${inviteId}/accept`, { keys });
  await rememberRoom(room);
  const conversation = `room:${room.id}`;
  await openConversation(conversation);
  await sendEvent(conversation, 'joined');
  return conversation;
}

export async function leaveRoom(roomId) {
  await sendEvent(`room:${roomId}`, 'left');
  await api.post(`/rooms/${roomId}/leave`);
  rooms.delete(roomId);
  roomKeys.delete(roomId);
  store.dispatch(contactRemoved(`room:${roomId}`));
}

/** Replaces the room key and seals the new one to every current member's current key. */
export async function rotateRoom(roomId) {
  const sodium = await loadSodium();
  const { data: room } = await api.get(`/rooms/${roomId}`);
  const key = sodium.randombytes_buf(32);
  const keys = {};
  for (const member of room.members) {
    // eslint-disable-next-line no-await-in-loop
    const history = await keysOf(member.id);
    if (!history.ok) throw new Error(`${member.username}'s keys don't verify; can't replace the room key`);
    keys[member.id] = { keyVersion: history.current.version, sealed: sealKey(sodium, key, history.current.encryptionKey) };
  }
  try {
    const { data } = await api.post(`/rooms/${roomId}/rotate`, { epoch: room.epoch + 1, keys });
    await rememberRoom(data);
    sendEvent(`room:${roomId}`, 'rotated');
  } catch (error) {
    if (error.status !== 409) throw error;
    await refreshRoom(roomId); // someone else rotated first; use their key
  }
}

export const onRoomChanged = (change) => (change.type === 'deleted'
  ? store.dispatch(contactRemoved(`room:${change.room}`))
  : refreshRoom(change.room));

// ---- read receipts (docs/DESIGN.md §6.4) ------------------------------------------------------

const receiptsOn = () => store.getState().session.user?.receiptsEnabled === true;

/** A receipt is only trusted if the reader signed it with their key. */
export async function receiveReceipt(receipt) {
  const sodium = await loadSodium();
  let verified = false;
  try {
    const history = await keysOf(receipt.reader, { minVersion: receipt.keyVersion });
    verified = history.ok && verifyObject(sodium, receipt, history.entries[receipt.keyVersion - 1]?.signingKey);
  } catch {
    verified = false;
  }
  store.dispatch(receiptReceived({
    conversation: receipt.conversation, reader: receipt.reader, upToSeq: receipt.upToSeq, at: receipt.at, verified,
  }));
}

export async function loadReceipts(conversation) {
  if (!receiptsOn()) return;
  const { data } = await api.get('/messages/receipts', { params: { conversation } });
  await Promise.all(data.filter((r) => r.reader !== me.id).map(receiveReceipt));
}

/**
 * Tells the others I've read up to the latest message, but only when receipts are on, the
 * conversation is open on screen, and there's something new from someone else.
 */
export async function markRead(conversation) {
  if (!me || !receiptsOn() || document.visibilityState !== 'visible') return;
  const { active, messages } = store.getState().chat;
  if (active !== conversation) return;
  const records = messages[conversation] || [];
  const latest = records[records.length - 1];
  if (!latest || latest.seq <= (receiptSent.get(conversation) || 0)) return;
  if (!records.some((r) => r.sender !== me.id && r.seq > (receiptSent.get(conversation) || 0))) return;
  receiptSent.set(conversation, latest.seq);
  const sodium = await loadSodium();
  const receipt = signObject(sodium, {
    type: 'read', reader: me.id, conversation, upToSeq: latest.seq, upToHash: latest.hash, at: new Date().toISOString(), keyVersion: myVersion(),
  }, fromB64(sodium, myKeys().signing.privateKey));
  await emitWithAck('receipt', receipt);
}

// ---- key changes (docs/DESIGN.md §5.2) -------------------------------------------------------

let onOwnKeysChanged = () => {};
// The key version this browser is creating right now. The server announces a change over the socket
// before its HTTP reply arrives, so without this the browser would lock itself out of its own rotation.
let expectedOwnVersion = 0;

export function expectOwnKeyVersion(version) {
  expectedOwnVersion = version;
}

/** Called when this account's keys change on another device: this browser must unlock again. */
export function setOwnKeysChangedHandler(handler) {
  onOwnKeysChanged = handler;
}

export function receiveKeysChanged({ user, version }) {
  histories.delete(user);
  store.dispatch(keysChanged({ user, version }));
  if (me && user === me.id && version > Math.max(currentKeys()?.signing.version || 0, expectedOwnVersion)) onOwnKeysChanged();
}
