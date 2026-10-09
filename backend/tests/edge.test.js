// Read when the modules load, so set before anything is required.
const SECRET = 'edge-secret-that-is-at-least-32-characters';
process.env.EDGE_SECRET = SECRET;
process.env.CLIENT_IP_HEADER = 'X-Client-IP';
process.env.RATE_LIMIT_AUTH = '2';
process.env.ANCHORING = 'on';

const request = require('supertest');
const { startServer, makeAccount, randomB64 } = require('./helpers');
const { io: connect } = require('socket.io-client');
const anchoring = require('../src/services/anchoring');

/*
 * With EDGE_SECRET set, the server answers only what came through the reverse proxy in front of
 * it, takes the visitor's address from the proxy, and lets only the proxy call /internal/ paths.
 */

let server;
beforeAll(async () => { server = await startServer(); });
afterEach(async () => {
  jest.restoreAllMocks();
  await server.reset();
});
afterAll(async () => { await server.stop(); });

const viaEdge = { 'X-Edge-Secret': SECRET };

test('requests that did not come through the proxy are refused; the health check is not', async () => {
  await request(server.app).get('/api/log/head').expect(404);
  await request(server.app).get('/api/log/head').set('X-Edge-Secret', `${SECRET}x`).expect(404);
  await request(server.app).get('/api/log/head').set(viaEdge).expect(200);
  await request(server.app).get('/health').expect(200);
});

test('sockets are refused the same way, before the session is even looked at', async () => {
  const attempt = (extraHeaders) => new Promise((resolve) => {
    const socket = connect(server.url, { extraHeaders, reconnection: false, forceNew: true });
    socket.on('connect', () => { socket.close(); resolve('connected'); });
    socket.on('connect_error', (err) => { socket.close(); resolve(err.message); });
  });
  expect(await attempt({})).not.toBe('unauthorized'); // refused at the door, not for its session
  expect(await attempt({})).not.toBe('connected');
  expect(await attempt(viaEdge)).toBe('unauthorized'); // let in, then asked for a session
});

test("rate limits count the visitor's address as the proxy reports it, not the proxy's own", async () => {
  const login = (address) => request(server.app).post('/api/auth/login')
    .set({ ...viaEdge, 'X-Client-IP': address }).send({ username: 'nobody', authKey: randomB64(32) });
  expect((await login('203.0.113.7')).status).toBe(401);
  expect((await login('203.0.113.7')).status).toBe(401);
  expect((await login('203.0.113.7')).status).toBe(429);
  // Another visitor through the same proxy has their own budget.
  expect((await login('203.0.113.8')).status).toBe(401);
});

test("the key log's clock can be run by the proxy's scheduled call, and by nobody else", async () => {
  const tick = jest.spyOn(anchoring, 'tick').mockResolvedValue();
  await request(server.app).post('/internal/anchor').expect(404);
  await request(server.app).post('/internal/anchor').set('X-Edge-Secret', 'wrong').expect(404);
  expect(tick).not.toHaveBeenCalled();
  await request(server.app).post('/internal/anchor').set(viaEdge).expect(204);
  expect(tick).toHaveBeenCalledTimes(1);
});

test('a visitor through the proxy signs up and uses the app as before', async () => {
  const agent = request.agent(server.app);
  agent.set(viaEdge);
  await agent.post('/api/auth/register').send(makeAccount('ada').body).expect(201);
  expect((await agent.get('/api/auth/me').expect(200)).body.username).toBe('ada');
});
