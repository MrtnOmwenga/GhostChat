const crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('../src/config');
const files = require('../src/services/files');
const {
  startServer, signUp, connectSocket, emitAck, envelope, dmOf, signedDeletion,
} = require('./helpers');

let server;
const sockets = [];
beforeAll(async () => { server = await startServer(); });
afterEach(async () => {
  sockets.splice(0).forEach((s) => s.close());
  await server.reset();
});
afterAll(async () => { await server.stop(); });

const pair = async () => {
  const ada = await signUp(server.app, 'ada');
  const grace = await signUp(server.app, 'grace');
  return { ada, grace, conversation: dmOf(ada.user.id, grace.user.id) };
};
const connectAs = async (who) => {
  const socket = await connectSocket(server.url, who.cookie);
  sockets.push(socket);
  return socket;
};
const upload = (who, conversation, bytes) => who.agent.post(`/api/files?conversation=${encodeURIComponent(conversation)}`)
  .set('Content-Type', 'application/octet-stream').send(bytes);
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const withFile = (from, to, conversation, attachment, extra = {}) => envelope(from, {
  conversation, recipients: [from.user.id, to.user.id], overrides: { attachments: [attachment] }, ...extra,
});
const storedIds = async () => (await mongoose.connection.db.collection('files.files').find().toArray()).map((f) => f._id);
const binary = (res, callback) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
};

describe('upload', () => {
  test('stores the bytes under their SHA-256 and only lets participants download them', async () => {
    const { ada, grace, conversation } = await pair();
    const bytes = crypto.randomBytes(200_000);
    const { body } = await upload(ada, conversation, bytes).expect(201);
    expect(body).toEqual({ id: sha256(bytes), size: bytes.length });

    const res = await grace.agent.get(`/api/files/${body.id}`).buffer(true).parse(binary).expect(200);
    expect(Buffer.compare(res.body, bytes)).toBe(0);
    expect(res.headers['content-type']).toBe('application/octet-stream');
    expect(res.headers['cache-control']).toMatch(/immutable/);

    const eve = await signUp(server.app, 'eve');
    await eve.agent.get(`/api/files/${body.id}`).expect(404);
    await grace.agent.get(`/api/files/${'0'.repeat(64)}`).expect(404);
    await grace.agent.get('/api/files/not-an-id').expect(400);
  });

  test('uploads need a participant, a body, and must fit the size limit and quota', async () => {
    const { ada, grace, conversation } = await pair();
    const eve = await signUp(server.app, 'eve');
    await upload(eve, conversation, crypto.randomBytes(10)).expect(403);
    await upload(ada, conversation, Buffer.alloc(0)).expect(400);
    await ada.agent.post(`/api/files?conversation=${conversation}`).send({ not: 'a file' }).expect(400);

    const { maxBytes, quotaBytes } = config.files;
    try {
      config.files.maxBytes = 1000;
      const tooBig = await upload(ada, conversation, crypto.randomBytes(1000 + 64 * 1024 + 1)).expect(413);
      expect(tooBig.body.error).toMatch(/up to/);
      config.files.maxBytes = maxBytes;
      config.files.quotaBytes = 150_000;
      await upload(grace, conversation, crypto.randomBytes(100_000)).expect(201);
      await upload(grace, conversation, crypto.randomBytes(60_000)).expect(413);
      await upload(ada, conversation, crypto.randomBytes(60_000)).expect(201); // quotas are per user
    } finally {
      Object.assign(config.files, { maxBytes, quotaBytes });
    }
  });

  test('re-uploading the same bytes is a safe retry, but not into another conversation', async () => {
    const { ada, grace, conversation } = await pair();
    const bytes = crypto.randomBytes(5000);
    const first = (await upload(ada, conversation, bytes).expect(201)).body;
    expect((await upload(ada, conversation, bytes).expect(201)).body).toEqual(first);
    await upload(grace, conversation, bytes).expect(409);
    expect(await storedIds()).toEqual([first.id]);
  });
});

describe('messages with attachments', () => {
  test('an envelope may only refer to files its sender uploaded into that conversation', async () => {
    const { ada, grace, conversation } = await pair();
    const eve = await signUp(server.app, 'eve');
    const socket = await connectAs(ada);
    const send = async (env) => (await emitAck(socket, 'message', env));

    const mine = (await upload(ada, conversation, crypto.randomBytes(3000)).expect(201)).body;
    const graces = (await upload(grace, conversation, crypto.randomBytes(3000)).expect(201)).body;
    const elsewhere = (await upload(ada, dmOf(ada.user.id, eve.user.id), crypto.randomBytes(3000)).expect(201)).body;

    expect((await send(withFile(ada, grace, conversation, { id: sha256(Buffer.from('never uploaded')), size: 14 }))).error).toMatch(/unknown attachment/);
    expect((await send(withFile(ada, grace, conversation, graces))).error).toMatch(/unknown attachment/);
    expect((await send(withFile(ada, grace, conversation, elsewhere))).error).toMatch(/unknown attachment/);
    expect((await send(withFile(ada, grace, conversation, { ...mine, size: mine.size + 1 }))).error).toMatch(/different size/);
    expect((await send(withFile(ada, grace, conversation, mine))).status).toBe('ok');
  });

  test('deleting the message deletes its file; deleting an account deletes all its files', async () => {
    const { ada, grace, conversation } = await pair();
    const socket = await connectAs(ada);
    const first = (await upload(ada, conversation, crypto.randomBytes(3000)).expect(201)).body;
    const sent = withFile(ada, grace, conversation, first);
    expect((await emitAck(socket, 'message', sent)).status).toBe('ok');

    const tomb = (await ada.agent.post('/api/messages/delete')
      .send({ deletion: signedDeletion(ada, { type: 'delete', conversation, seq: 1, hash: sent.hash }) }).expect(200)).body;
    expect(tomb.attachments).toEqual([first]);
    expect(await storedIds()).toEqual([]);
    await grace.agent.get(`/api/files/${first.id}`).expect(404);

    const second = (await upload(ada, conversation, crypto.randomBytes(3000)).expect(201)).body;
    expect((await emitAck(socket, 'message', withFile(ada, grace, conversation, second, { seq: 2, prev: sent.hash }))).status).toBe('ok');
    const unsent = (await upload(ada, conversation, crypto.randomBytes(3000)).expect(201)).body;
    const kept = (await upload(grace, conversation, crypto.randomBytes(3000)).expect(201)).body;
    await ada.agent.delete('/api/users/me').send({ deletion: signedDeletion(ada, { type: 'account-deleted' }) }).expect(204);
    expect(await storedIds()).toEqual([kept.id]);
    expect(unsent.id).not.toBe(kept.id);
  });

  test('uploads no message refers to are swept after an hour', async () => {
    const { ada, grace, conversation } = await pair();
    const socket = await connectAs(ada);
    const used = (await upload(ada, conversation, crypto.randomBytes(3000)).expect(201)).body;
    const orphan = (await upload(ada, conversation, crypto.randomBytes(3000)).expect(201)).body;
    expect((await emitAck(socket, 'message', withFile(ada, grace, conversation, used))).status).toBe('ok');

    expect(await files.sweep()).toBe(0); // too recent
    expect(await files.sweep(Date.now() + 61 * 60 * 1000)).toBe(1);
    expect(await storedIds()).toEqual([used.id]);
    expect(orphan.id).not.toBe(used.id);
  });
});
