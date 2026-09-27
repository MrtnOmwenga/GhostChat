const crypto = require('crypto');
const {
  startServer, signUp, connectSocket, nextEvent, emitAck, envelope, dmOf, sealedKey, randomB64,
} = require('./helpers');
const { genesisHash } = require('../src/services/chain');

let server;
const sockets = [];
beforeAll(async () => { server = await startServer(); });
afterEach(async () => {
  sockets.splice(0).forEach((s) => s.close());
  await server.reset();
});
afterAll(async () => { await server.stop(); });

const connectAs = async (who) => {
  const socket = await connectSocket(server.url, who.cookie);
  sockets.push(socket);
  return socket;
};
const pair = async () => {
  const ada = await signUp(server.app, 'ada');
  const grace = await signUp(server.app, 'grace');
  return { ada, grace, conversation: dmOf(ada.user.id, grace.user.id) };
};
const dm = (from, to, conversation, extra = {}) => envelope(from, { conversation, recipients: [from.user.id, to.user.id], ...extra });

test('connections without a valid session are refused', async () => {
  await expect(connectSocket(server.url)).rejects.toThrow('unauthorized');
  await expect(connectSocket(server.url, 'ghostchat_session=forged')).rejects.toThrow('unauthorized');
});

describe('direct messages', () => {
  test('an envelope reaches the recipient unchanged and is stored in the chain', async () => {
    const { ada, grace, conversation } = await pair();
    const adaSocket = await connectAs(ada);
    const graceSocket = await connectAs(grace);
    const sent = dm(ada, grace, conversation);
    const received = nextEvent(graceSocket, 'message');
    expect(await emitAck(adaSocket, 'message', sent)).toEqual({ status: 'ok', envelope: sent });
    expect(await received).toEqual(sent);
    const history = await grace.agent.get(`/api/messages?conversation=${conversation}`).expect(200);
    expect(history.body).toEqual([sent]);
  });

  test('simultaneous sends: one lands, the other gets a conflict with what it missed', async () => {
    const { ada, grace, conversation } = await pair();
    const [adaSocket, graceSocket] = [await connectAs(ada), await connectAs(grace)];
    const first = dm(ada, grace, conversation);
    const second = dm(grace, ada, conversation);
    expect((await emitAck(adaSocket, 'message', first)).status).toBe('ok');
    const reply = await emitAck(graceSocket, 'message', second);
    expect(reply).toMatchObject({ status: 'conflict', head: { seq: 1, hash: first.hash }, missing: [first] });

    const rebased = dm(grace, ada, conversation, { seq: 2, prev: first.hash });
    expect((await emitAck(graceSocket, 'message', rebased)).status).toBe('ok');
  });

  test('forged, tampered or misaddressed envelopes are rejected', async () => {
    const { ada, grace, conversation } = await pair();
    const socket = await connectAs(ada);
    const send = async (env) => (await emitAck(socket, 'message', env)).error;

    const asGrace = envelope(ada, { conversation, recipients: [ada.user.id, grace.user.id], overrides: { sender: grace.user.id } });
    expect(await send(asGrace)).toMatch(/sender must be/);
    expect(await send({ ...dm(ada, grace, conversation), ciphertext: randomB64(60) })).toMatch(/hash does not match/);
    expect(await send(dm(ada, grace, conversation, { signWith: crypto.generateKeyPairSync('ed25519').privateKey }))).toMatch(/invalid signature/);
    expect(await send(envelope(ada, { conversation, recipients: [grace.user.id] }))).toMatch(/sealed to both/);
    expect(await send(dm(ada, grace, conversation, { overrides: { senderKeyVersion: 2 } }))).toMatch(/current key/);
    const outsider = await signUp(server.app, 'eve');
    const fresh = await connectAs(ada); // the first socket has used its message budget
    expect((await emitAck(fresh, 'message', dm(ada, outsider, dmOf(grace.user.id, outsider.user.id)))).error).toMatch(/not a participant/);
  });

  test('conversations list each chat with its latest envelope, most recent first', async () => {
    const { ada, grace, conversation } = await pair();
    const alan = await signUp(server.app, 'alan');
    const [adaSocket, alanSocket] = [await connectAs(ada), await connectAs(alan)];
    await emitAck(adaSocket, 'message', dm(ada, grace, conversation));
    const last = dm(alan, ada, dmOf(ada.user.id, alan.user.id));
    await emitAck(alanSocket, 'message', last);
    const res = await ada.agent.get('/api/messages/conversations').expect(200);
    expect(res.body.map((c) => c.peer.username)).toEqual(['alan', 'grace']);
    expect(res.body[0].last).toEqual(last);
    await grace.agent.get(`/api/messages?conversation=${dmOf(ada.user.id, alan.user.id)}`).expect(403);
  });

  test('deleting an account leaves tombstones that keep the chain intact', async () => {
    const { ada, grace, conversation } = await pair();
    const [adaSocket, graceSocket] = [await connectAs(ada), await connectAs(grace)];
    const first = dm(ada, grace, conversation);
    await emitAck(adaSocket, 'message', first);
    const second = dm(grace, ada, conversation, { seq: 2, prev: first.hash });
    await emitAck(graceSocket, 'message', second);

    const closed = nextEvent(adaSocket, 'disconnect');
    await ada.agent.delete('/api/users/me').expect(204);
    await closed;
    const history = (await grace.agent.get(`/api/messages?conversation=${conversation}`)).body;
    expect(history[0]).toMatchObject({ seq: 1, hash: first.hash, deleted: { reason: 'account-deleted' } });
    expect(history[0].ciphertext).toBeUndefined();
    expect(history[1]).toEqual(second);
  });
});

describe('rooms', () => {
  const createRoom = async (owner) => (await owner.agent.post('/api/rooms').send({ name: 'Night Owls', key: sealedKey() }).expect(201)).body;
  const inviteKeys = (epochs) => Array.from({ length: epochs }, (_, i) => ({ epoch: i + 1, nonce: randomB64(24), ciphertext: randomB64(48) }));

  test('members post under the current epoch; outsiders cannot', async () => {
    const { ada, grace } = await pair();
    const room = await createRoom(ada);
    expect(room).toMatchObject({ name: 'Night Owls', epoch: 1, keys: [{ epoch: 1, keyVersion: 1 }] });
    const conversation = `room:${room.id}`;
    const [adaSocket, graceSocket] = [await connectAs(ada), await connectAs(grace)];
    expect((await emitAck(adaSocket, 'message', envelope(ada, { conversation, epoch: 1 }))).status).toBe('ok');
    expect((await emitAck(graceSocket, 'message', envelope(grace, { conversation, epoch: 1 }))).error).toMatch(/not a participant/);
    expect((await emitAck(adaSocket, 'message', envelope(ada, { conversation, epoch: 2, seq: 2 }))).error).toMatch(/epoch 1/);
  });

  test('invites carry every epoch key and join the member; single-use invites run out', async () => {
    const { ada, grace } = await pair();
    const eve = await signUp(server.app, 'eve');
    const room = await createRoom(ada);
    await ada.agent.post(`/api/rooms/${room.id}/invites`).send({ keys: [] }).expect(400);
    const invite = (await ada.agent.post(`/api/rooms/${room.id}/invites`).send({ keys: inviteKeys(1), singleUse: true }).expect(201)).body;

    const fetched = (await grace.agent.get(`/api/invites/${invite.id}`).expect(200)).body;
    expect(fetched.room).toEqual({ id: room.id, name: 'Night Owls', epoch: 1 });
    await grace.agent.post(`/api/invites/${invite.id}/accept`).send({ keys: [{ epoch: 1, ...sealedKey() }] }).expect(200);
    expect((await grace.agent.get('/api/rooms/mine')).body[0].members.map((m) => m.username).sort()).toEqual(['ada', 'grace']);
    await eve.agent.get(`/api/invites/${invite.id}`).expect(404);
  });

  test('after someone leaves, sending needs a new key sealed to every remaining member', async () => {
    const { ada, grace } = await pair();
    const room = await createRoom(ada);
    const invite = (await ada.agent.post(`/api/rooms/${room.id}/invites`).send({ keys: inviteKeys(1) })).body;
    await grace.agent.post(`/api/invites/${invite.id}/accept`).send({ keys: [{ epoch: 1, ...sealedKey() }] }).expect(200);
    await grace.agent.post(`/api/rooms/${room.id}/leave`).expect(204);
    await grace.agent.get(`/api/invites/${invite.id}`).expect(404); // leaving cancels invites

    const conversation = `room:${room.id}`;
    const socket = await connectAs(ada);
    expect(await emitAck(socket, 'message', envelope(ada, { conversation, epoch: 1 }))).toMatchObject({ status: 'rotation-needed' });
    await ada.agent.post(`/api/rooms/${room.id}/rotate`).send({ epoch: 2, keys: { [grace.user.id]: sealedKey() } }).expect(400);
    const rotated = (await ada.agent.post(`/api/rooms/${room.id}/rotate`).send({ epoch: 2, keys: { [ada.user.id]: sealedKey() } }).expect(200)).body;
    expect(rotated).toMatchObject({ epoch: 2, rotationPending: false });
    expect(rotated.keys.map((k) => k.epoch)).toEqual([1, 2]);
    await ada.agent.post(`/api/rooms/${room.id}/rotate`).send({ epoch: 2, keys: { [ada.user.id]: sealedKey() } }).expect(409);
    expect((await emitAck(socket, 'message', envelope(ada, { conversation, epoch: 2 }))).status).toBe('ok');
  });

  test('a new member can read the whole history; a removed one can no longer read it', async () => {
    const { ada, grace } = await pair();
    const room = await createRoom(ada);
    const conversation = `room:${room.id}`;
    const socket = await connectAs(ada);
    const early = envelope(ada, { conversation, epoch: 1 });
    await emitAck(socket, 'message', early);
    const invite = (await ada.agent.post(`/api/rooms/${room.id}/invites`).send({ keys: inviteKeys(1) })).body;
    await grace.agent.post(`/api/invites/${invite.id}/accept`).send({ keys: [{ epoch: 1, ...sealedKey() }] });
    expect((await grace.agent.get(`/api/messages?conversation=${conversation}`)).body).toEqual([early]);
    await grace.agent.post(`/api/rooms/${room.id}/leave`);
    await grace.agent.get(`/api/messages?conversation=${conversation}`).expect(403);
  });
});

test('presence goes offline only when the last connection closes', async () => {
  const { ada, grace } = await pair();
  const graceSocket = await connectAs(grace);
  const online = nextEvent(graceSocket, 'presence');
  const tab1 = await connectAs(ada);
  expect(await online).toEqual({ userId: ada.user.id, online: true });
  const tab2 = await connectAs(ada);
  expect(await emitAck(graceSocket, 'presence', [ada.user.id])).toEqual([ada.user.id]);
  tab1.close();
  await new Promise((r) => { setTimeout(r, 100); });
  expect(await emitAck(graceSocket, 'presence', [ada.user.id])).toEqual([ada.user.id]);
  const offline = nextEvent(graceSocket, 'presence');
  tab2.close();
  expect(await offline).toEqual({ userId: ada.user.id, online: false });
});

test('message sending is rate limited per connection', async () => {
  const { ada, grace, conversation } = await pair();
  const socket = await connectAs(ada);
  const results = [];
  let prev = genesisHash(conversation);
  for (let i = 1; i <= 7; i += 1) {
    const env = dm(ada, grace, conversation, { seq: i, prev });
    // eslint-disable-next-line no-await-in-loop
    const reply = await emitAck(socket, 'message', env);
    if (reply.status === 'ok') prev = env.hash;
    results.push(reply);
  }
  expect(results.filter((r) => r.error === 'Slow down')).toHaveLength(2);
});
