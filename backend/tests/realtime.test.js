const {
  startServer, signUp, connectSocket, nextEvent, emitAck,
} = require('./helpers');

let server;
const sockets = [];
beforeAll(async () => { server = await startServer(); });
afterEach(async () => {
  sockets.splice(0).forEach((s) => s.close());
  await server.reset();
});
afterAll(async () => { await server.stop(); });

const connectAs = async (cookie) => {
  const socket = await connectSocket(server.url, cookie);
  sockets.push(socket);
  return socket;
};

test('connections without a valid session are refused', async () => {
  await expect(connectSocket(server.url)).rejects.toThrow('unauthorized');
  await expect(connectSocket(server.url, 'ghostchat_session=forged')).rejects.toThrow('unauthorized');
});

test('a direct message reaches the recipient, is stored, and names the real sender', async () => {
  const ada = await signUp(server.app, 'ada');
  const grace = await signUp(server.app, 'grace');
  const adaSocket = await connectAs(ada.cookie);
  const graceSocket = await connectAs(grace.cookie);

  const received = nextEvent(graceSocket, 'message');
  // The spoofed `from` is ignored: the sender comes from the session.
  const ack = await emitAck(adaSocket, 'message', { to: grace.user.id, text: 'hello', from: grace.user.id });
  expect(ack.error).toBeUndefined();

  const message = await received;
  expect(message).toMatchObject({ text: 'hello', from: { id: ada.user.id, username: 'ada' }, to: grace.user.id });

  const history = await grace.agent.get(`/api/messages?with=${ada.user.id}`).expect(200);
  expect(history.body.map((m) => m.text)).toEqual(['hello']);
});

test('conversations list the people you have messaged, most recent first', async () => {
  const ada = await signUp(server.app, 'ada');
  const grace = await signUp(server.app, 'grace');
  const alan = await signUp(server.app, 'alan');
  const adaSocket = await connectAs(ada.cookie);
  const alanSocket = await connectAs(alan.cookie);
  await emitAck(adaSocket, 'message', { to: grace.user.id, text: 'first' });
  await emitAck(alanSocket, 'message', { to: ada.user.id, text: 'second' });

  const res = await ada.agent.get('/api/messages/conversations').expect(200);
  expect(res.body.map((u) => u.username)).toEqual(['alan', 'grace']);
  expect(JSON.stringify(res.body)).not.toMatch(/password/i);
});

test('messages to unknown users and invalid payloads are rejected', async () => {
  const ada = await signUp(server.app, 'ada');
  const socket = await connectAs(ada.cookie);
  expect((await emitAck(socket, 'message', { to: '0123456789abcdef01234567', text: 'hi' })).error).toBe('No such user');
  expect((await emitAck(socket, 'message', { text: 'no recipient' })).error).toBeDefined();
  expect((await emitAck(socket, 'message', { to: ada.user.id, text: '' })).error).toBeDefined();
});

test('room messages reach members only, and non-members cannot post', async () => {
  const ada = await signUp(server.app, 'ada');
  const grace = await signUp(server.app, 'grace');
  const eve = await signUp(server.app, 'eve');
  const room = (await ada.agent.post('/api/rooms').send({ name: 'Engine', password: 'difference' })).body;

  const adaSocket = await connectAs(ada.cookie);
  const graceSocket = await connectAs(grace.cookie);
  const eveSocket = await connectAs(eve.cookie);

  // Joining over REST subscribes Grace's already-open socket and announces her.
  const announced = nextEvent(adaSocket, 'announcement');
  await grace.agent.post('/api/rooms/join').send({ name: 'Engine', password: 'difference' }).expect(200);
  expect((await announced).text).toBe('grace joined the room');

  let eveReceived = false;
  eveSocket.on('message', () => { eveReceived = true; });
  const toGrace = nextEvent(graceSocket, 'message');
  await emitAck(adaSocket, 'message', { room: room.id, text: 'welcome' });
  expect((await toGrace).text).toBe('welcome');

  expect((await emitAck(eveSocket, 'message', { room: room.id, text: 'let me in' })).error).toBe('Not a member of this room');
  expect(eveReceived).toBe(false);
});

test('presence goes offline only when the last connection closes', async () => {
  const ada = await signUp(server.app, 'ada');
  const grace = await signUp(server.app, 'grace');
  const graceSocket = await connectAs(grace.cookie);

  const online = nextEvent(graceSocket, 'presence');
  const tab1 = await connectAs(ada.cookie);
  expect(await online).toEqual({ userId: ada.user.id, online: true });
  const tab2 = await connectAs(ada.cookie);
  expect(await emitAck(graceSocket, 'presence', [ada.user.id])).toEqual([ada.user.id]);

  tab1.close();
  await new Promise((r) => { setTimeout(r, 100); });
  expect(await emitAck(graceSocket, 'presence', [ada.user.id])).toEqual([ada.user.id]);

  const offline = nextEvent(graceSocket, 'presence');
  tab2.close();
  expect(await offline).toEqual({ userId: ada.user.id, online: false });
});

test('message sending is rate limited per connection', async () => {
  const ada = await signUp(server.app, 'ada');
  const grace = await signUp(server.app, 'grace');
  const socket = await connectAs(ada.cookie);
  const results = [];
  for (let i = 0; i < 7; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await emitAck(socket, 'message', { to: grace.user.id, text: `m${i}` }));
  }
  expect(results.filter((r) => r.error === 'Slow down')).toHaveLength(2);
});

test('deleting an account removes its messages and closes its connections', async () => {
  const ada = await signUp(server.app, 'ada');
  const grace = await signUp(server.app, 'grace');
  const room = (await ada.agent.post('/api/rooms').send({ name: 'Solo', password: 'difference' })).body;
  const adaSocket = await connectAs(ada.cookie);
  await emitAck(adaSocket, 'message', { to: grace.user.id, text: 'soon gone' });
  await emitAck(adaSocket, 'message', { room: room.id, text: 'also gone' });

  const disconnected = nextEvent(adaSocket, 'disconnect');
  await ada.agent.delete('/api/users/me').expect(204);
  await disconnected;

  const history = await grace.agent.get(`/api/messages?with=${ada.user.id}`).expect(200);
  expect(history.body).toEqual([]);
  // Ada was the room's only member, so the room is gone too.
  await grace.agent.post('/api/rooms/join').send({ name: 'Solo', password: 'difference' }).expect(401);
});
