const http = require('http');
const crypto = require('crypto');
const mongoose = require('mongoose');
const request = require('supertest');
const { io: connect } = require('socket.io-client');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../src/app');
const { createRealtime } = require('../src/realtime');
const { MemoryPresence } = require('../src/presence');
const { didFromSigningKey, keyCommitment, objectHash } = require('../src/crypto');

/** Starts the full server (HTTP + Socket.IO) on a random port against an in-memory MongoDB. */
async function startServer() {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const app = createApp();
  const server = http.createServer(app);
  const realtime = createRealtime(server, { presence: new MemoryPresence() });
  app.set('realtime', realtime);
  await new Promise((resolve) => { server.listen(0, resolve); });
  const url = `http://localhost:${server.address().port}`;

  return {
    app,
    url,
    async reset() {
      await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
    },
    async stop() {
      realtime.close();
      await new Promise((resolve) => { server.close(resolve); });
      await mongoose.disconnect();
      await mongo.stop();
    },
  };
}

const b64 = (bytes) => Buffer.from(bytes).toString('base64url');
const randomB64 = (n) => b64(crypto.randomBytes(n));

/** A key pair with its raw public key, generated with node:crypto (independently of the frontend). */
function keyPair(type) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync(type);
  return { publicKey: publicKey.export({ format: 'jwk' }).x, privateKey };
}

/**
 * What a client would generate for a new account: a signed version 1 key entry committing to a
 * version 2 key, plus the random material the server stores but can't interpret.
 */
function makeAccount(username) {
  const signing = keyPair('ed25519');
  const next = keyPair('ed25519');
  const entry = {
    type: 'create',
    username,
    did: didFromSigningKey(signing.publicKey),
    version: 1,
    signingKey: signing.publicKey,
    encryptionKey: keyPair('x25519').publicKey,
    nextKeyCommitment: keyCommitment(next.publicKey),
    prev: null,
    reason: '',
    createdAt: new Date().toISOString(),
  };
  entry.signature = b64(crypto.sign(null, Buffer.from(objectHash(entry)), signing.privateKey));
  return {
    signing,
    entry,
    body: {
      username, salt: randomB64(16), authKey: randomB64(32), vault: { nonce: randomB64(24), ciphertext: randomB64(80) }, keyEntry: entry,
    },
  };
}

/** Registers a user and returns a supertest agent carrying their session cookie. */
async function signUp(app, username) {
  const account = makeAccount(username);
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send(account.body).expect(201);
  const cookie = res.headers['set-cookie'][0].split(';')[0];
  return { agent, user: res.body, cookie, account };
}

const { genesisHash } = require('../src/services/chain');

const dmOf = (a, b) => `dm:${[a, b].sort().join(':')}`;

/**
 * A signed envelope as a client would send it. The server never decrypts, so random bytes stand
 * in for the ciphertext and sealed keys; everything the server does check is real.
 */
function envelope(from, {
  conversation, seq = 1, prev, recipients = [], epoch, signWith = from.account.signing.privateKey, overrides = {},
}) {
  const body = {
    v: 1,
    conversation,
    seq,
    prev: prev || genesisHash(conversation),
    sender: from.user.id,
    senderKeyVersion: 1,
    ...(epoch ? { epoch } : {}),
    nonce: randomB64(24),
    ciphertext: randomB64(60),
    ...(recipients.length ? { keys: Object.fromEntries(recipients.map((id) => [id, { keyVersion: 1, sealed: randomB64(80) }])) } : {}),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
  body.hash = objectHash(body);
  body.signature = b64(crypto.sign(null, Buffer.from(body.hash), signWith));
  return body;
}

const sealedKey = () => ({ keyVersion: 1, sealed: randomB64(80) });

/** A deletion signed by `from` (docs/DESIGN.md §6.3). */
function signedDeletion(from, fields) {
  const body = { user: from.user.id, at: new Date().toISOString(), keyVersion: 1, ...fields };
  return { ...body, signature: b64(crypto.sign(null, Buffer.from(objectHash(body)), from.account.signing.privateKey)) };
}

function connectSocket(url, cookie) {
  return new Promise((resolve, reject) => {
    const socket = connect(url, { extraHeaders: cookie ? { cookie } : {}, reconnection: false, forceNew: true });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => { socket.close(); reject(err); });
  });
}

const nextEvent = (socket, event) => new Promise((resolve) => { socket.once(event, resolve); });
const emitAck = (socket, event, payload) => new Promise((resolve) => { socket.emit(event, payload, resolve); });

module.exports = {
  startServer, signUp, makeAccount, randomB64, connectSocket, nextEvent, emitAck, envelope, dmOf, sealedKey, signedDeletion,
};
