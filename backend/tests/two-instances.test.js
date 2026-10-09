const http = require('http');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createApp } = require('../src/app');
const { createRealtime } = require('../src/realtime');
const { RedisPresence } = require('../src/presence');
const {
  makeAccount, connectSocket, nextEvent, emitAck, envelope, dmOf, sealedKey, randomB64,
} = require('./helpers');

/*
 * Two instances of the server, as they would run behind a load balancer: each with its own
 * sockets and memory, sharing MongoDB and Redis. Every test puts people on different instances
 * and checks they are in the same conversation.
 *
 * Needs a Redis (TEST_REDIS_URL). CI provides one; without it these tests are skipped, loudly.
 */

const redisUrl = process.env.TEST_REDIS_URL;
const suite = redisUrl ? describe : describe.skip;
if (!redisUrl && process.env.CI) throw new Error('TEST_REDIS_URL must be set in CI: these tests may not be skipped there');
if (!redisUrl) console.warn('TEST_REDIS_URL is not set: the two-instance tests are skipped');

suite('two instances', () => {
  let mongo;
  const instances = [];
  const clients = [];
  const sockets = [];

  async function startInstance() {
    const pub = createClient({ url: redisUrl });
    const sub = pub.duplicate();
    await Promise.all([pub.connect(), sub.connect()]);
    clients.push(pub, sub);
    const app = createApp();
    const server = http.createServer(app);
    const realtime = createRealtime(server, { presence: new RedisPresence(pub), adapter: createAdapter(pub, sub) });
    app.set('realtime', realtime);
    await new Promise((resolve) => { server.listen(0, resolve); });
    return { app, server, realtime, url: `http://localhost:${server.address().port}` };
  }

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    instances.push(await startInstance(), await startInstance());
  });
  afterEach(async () => {
    sockets.splice(0).forEach((s) => s.close());
    await new Promise((resolve) => { setTimeout(resolve, 100); }); // let disconnects reach Redis
    await Promise.all((await mongoose.connection.db.collections()).map((c) => c.deleteMany({})));
    await clients[0].del('ghostchat:presence');
  });
  afterAll(async () => {
    for (const { realtime, server } of instances) {
      realtime.close();
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => { server.close(resolve); });
    }
    await Promise.all(clients.map((c) => c.quit().catch(() => {})));
    await mongoose.disconnect();
    await mongo.stop();
  });

  /** Signs up through one instance; the session works on both, since it is a row in the database. */
  async function signUp(instance, username) {
    const account = makeAccount(username);
    const agent = request.agent(instance.app);
    const res = await agent.post('/api/auth/register').send(account.body).expect(201);
    return { agent, account, user: res.body, cookie: res.headers['set-cookie'][0].split(';')[0] };
  }
  const connectTo = async (instance, who) => {
    const socket = await connectSocket(instance.url, who.cookie);
    sockets.push(socket);
    return socket;
  };

  test('a message sent through one instance reaches its recipient on the other', async () => {
    const [one, two] = instances;
    const ada = await signUp(one, 'ada');
    const grace = await signUp(two, 'grace');
    const adaSocket = await connectTo(one, ada);
    const graceSocket = await connectTo(two, grace);
    const conversation = dmOf(ada.user.id, grace.user.id);
    const sent = envelope(ada, { conversation, recipients: [ada.user.id, grace.user.id] });
    const received = nextEvent(graceSocket, 'message');
    expect(await emitAck(adaSocket, 'message', sent)).toEqual({ status: 'ok', envelope: sent });
    expect(await received).toEqual(sent);
  });

  test('a session started on one instance opens a socket on the other', async () => {
    const [one, two] = instances;
    const ada = await signUp(one, 'ada');
    const socket = await connectTo(two, ada);
    expect(socket.connected).toBe(true);
    expect((await request(two.app).get('/api/auth/me').set('Cookie', ada.cookie).expect(200)).body.username).toBe('ada');
  });

  test('signing out through one instance closes the socket held by the other', async () => {
    const [one, two] = instances;
    const ada = await signUp(one, 'ada');
    const socket = await connectTo(two, ada);
    const closed = nextEvent(socket, 'disconnect');
    await ada.agent.post('/api/auth/logout').expect(204); // handled by instance one
    expect(await closed).toBe('io server disconnect');
    await expect(connectSocket(two.url, ada.cookie)).rejects.toThrow('unauthorized');
  });

  test('presence is one count across instances: online until the last tab, wherever it is, closes', async () => {
    const [one, two] = instances;
    const ada = await signUp(one, 'ada');
    const grace = await signUp(two, 'grace');
    const graceSocket = await connectTo(two, grace);
    const online = () => emitAck(graceSocket, 'presence', [ada.user.id]);
    expect(await online()).toEqual([]);

    const cameOnline = nextEvent(graceSocket, 'presence');
    const tabOnOne = await connectTo(one, ada);
    expect(await cameOnline).toEqual({ userId: ada.user.id, online: true });
    const tabOnTwo = await connectTo(two, ada);
    expect(await online()).toEqual([ada.user.id]);

    tabOnOne.close();
    await new Promise((resolve) => { setTimeout(resolve, 200); });
    expect(await online()).toEqual([ada.user.id]); // the other tab, on the other instance, is still open
    const wentOffline = nextEvent(graceSocket, 'presence');
    tabOnTwo.close();
    expect(await wentOffline).toEqual({ userId: ada.user.id, online: false });
    expect(await online()).toEqual([]);
  });

  test('joining a room through one instance subscribes a socket on the other, with no reconnect', async () => {
    const [one, two] = instances;
    const ada = await signUp(one, 'ada');
    const grace = await signUp(two, 'grace');
    const room = (await ada.agent.post('/api/rooms').send({ name: 'Night Owls', key: sealedKey() }).expect(201)).body;
    const invite = (await ada.agent.post(`/api/rooms/${room.id}/invites`)
      .send({ keys: [{ epoch: 1, nonce: randomB64(24), ciphertext: randomB64(48) }], singleUse: true }).expect(201)).body;

    // Grace's socket is on instance two; her request to join is handled by instance one.
    const graceSocket = await connectTo(two, grace);
    const adaSocket = await connectTo(one, ada);
    await request(one.app).post(`/api/invites/${invite.id}/accept`).set('Cookie', grace.cookie).send({ keys: [{ epoch: 1, ...sealedKey() }] }).expect(200);

    const sent = envelope(ada, { conversation: `room:${room.id}`, epoch: 1 });
    const received = nextEvent(graceSocket, 'message');
    expect((await emitAck(adaSocket, 'message', sent)).status).toBe('ok');
    expect(await received).toEqual(sent);
  });
});
