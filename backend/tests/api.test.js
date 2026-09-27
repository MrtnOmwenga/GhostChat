const request = require('supertest');
const { startServer, signUp } = require('./helpers');

let server;
beforeAll(async () => { server = await startServer(); });
afterEach(async () => { await server.reset(); });
afterAll(async () => { await server.stop(); });

const noPasswordFields = (body) => {
  const text = JSON.stringify(body);
  expect(text).not.toMatch(/password/i);
  expect(text).not.toMatch(/\$2[aby]\$/); // bcrypt hash prefix
};

describe('auth', () => {
  test('register sets an httpOnly, SameSite=Strict session cookie and returns no hash', async () => {
    const res = await request(server.app).post('/api/auth/register')
      .send({ username: 'ada', password: 'correct horse' }).expect(201);
    expect(res.body).toEqual({ id: expect.any(String), username: 'ada' });
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
  });

  test('duplicate usernames are rejected', async () => {
    await signUp(server.app, 'ada');
    await request(server.app).post('/api/auth/register')
      .send({ username: 'ada', password: 'another pass' }).expect(409);
  });

  test('weak or malformed credentials are rejected', async () => {
    await request(server.app).post('/api/auth/register').send({ username: 'ada', password: 'short' }).expect(400);
    await request(server.app).post('/api/auth/register').send({ username: '<script>', password: 'long enough' }).expect(400);
    await request(server.app).post('/api/auth/register').send({ username: { $gt: '' }, password: 'long enough' }).expect(400);
  });

  test('login, me and logout', async () => {
    await signUp(server.app, 'ada');
    const agent = request.agent(server.app);
    await agent.post('/api/auth/login').send({ username: 'ada', password: 'wrong password' }).expect(401);
    await agent.post('/api/auth/login').send({ username: 'nobody', password: 'wrong password' }).expect(401);
    await agent.post('/api/auth/login').send({ username: 'ada', password: 'correct horse' }).expect(200);
    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.username).toBe('ada');
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  test('a forged or tampered session is rejected', async () => {
    await request(server.app).get('/api/auth/me').set('Cookie', 'ghostchat_session=not-a-jwt').expect(401);
    const { cookie } = await signUp(server.app, 'ada');
    const tampered = `${cookie.slice(0, -4)}AAAA`;
    await request(server.app).get('/api/auth/me').set('Cookie', tampered).expect(401);
  });
});

describe('users', () => {
  test('every route requires a session', async () => {
    await request(server.app).get('/api/users/search?q=a').expect(401);
    await request(server.app).patch('/api/users/me').send({ username: 'x' }).expect(401);
    await request(server.app).delete('/api/users/me').expect(401);
  });

  test('search finds others by prefix, never the searcher, and leaks no hashes', async () => {
    const { agent } = await signUp(server.app, 'ada');
    await signUp(server.app, 'adam');
    await signUp(server.app, 'grace');
    const res = await agent.get('/api/users/search?q=ad').expect(200);
    expect(res.body.map((u) => u.username)).toEqual(['adam']);
    noPasswordFields(res.body);
  });

  test('search input cannot inject regex or operators', async () => {
    const { agent } = await signUp(server.app, 'ada');
    await agent.get('/api/users/search?q=.*').expect(400);
    await agent.get('/api/users/search?q[$ne]=x').expect(400);
  });

  test('a password change is hashed and takes effect', async () => {
    const { agent } = await signUp(server.app, 'ada');
    await agent.patch('/api/users/me').send({ password: 'a new password' }).expect(200);
    await request(server.app).post('/api/auth/login').send({ username: 'ada', password: 'correct horse' }).expect(401);
    await request(server.app).post('/api/auth/login').send({ username: 'ada', password: 'a new password' }).expect(200);
  });

  test('users can only delete themselves', async () => {
    const { agent } = await signUp(server.app, 'ada');
    const { user: grace } = await signUp(server.app, 'grace');
    await agent.delete(`/api/users/${grace.id}`).expect(404);
    await agent.delete('/api/users/me').expect(204);
    await request(server.app).post('/api/auth/login').send({ username: 'ada', password: 'correct horse' }).expect(401);
  });
});

describe('rooms', () => {
  test('create, join with the password, list mine', async () => {
    const { agent: ada } = await signUp(server.app, 'ada');
    const { agent: grace } = await signUp(server.app, 'grace');
    const room = await ada.post('/api/rooms').send({ name: 'Engine', password: 'difference' }).expect(201);
    noPasswordFields(room.body);

    await grace.post('/api/rooms/join').send({ name: 'Engine', password: 'wrong one!' }).expect(401);
    await grace.post('/api/rooms/join').send({ name: 'Engine', password: 'difference' }).expect(200);
    const mine = await grace.get('/api/rooms/mine').expect(200);
    expect(mine.body.map((r) => r.name)).toEqual(['Engine']);
    noPasswordFields(mine.body);
  });

  test('joining requires a session and room names are unique', async () => {
    const { agent } = await signUp(server.app, 'ada');
    await agent.post('/api/rooms').send({ name: 'Engine', password: 'difference' }).expect(201);
    await agent.post('/api/rooms').send({ name: 'Engine', password: 'difference' }).expect(409);
    await request(server.app).post('/api/rooms/join').send({ name: 'Engine', password: 'difference' }).expect(401);
  });

  test("a deleted creator's room passes to the next member", async () => {
    const { agent: ada } = await signUp(server.app, 'ada');
    const { agent: grace } = await signUp(server.app, 'grace');
    const room = await ada.post('/api/rooms').send({ name: 'Engine', password: 'difference' }).expect(201);
    await grace.post('/api/rooms/join').send({ name: 'Engine', password: 'difference' });
    await ada.delete('/api/users/me').expect(204);
    await grace.delete(`/api/rooms/${room.body.id}`).expect(204);
  });

  test('only the creator can delete a room', async () => {
    const { agent: ada } = await signUp(server.app, 'ada');
    const { agent: grace } = await signUp(server.app, 'grace');
    const room = await ada.post('/api/rooms').send({ name: 'Engine', password: 'difference' }).expect(201);
    await grace.post('/api/rooms/join').send({ name: 'Engine', password: 'difference' });
    await grace.delete(`/api/rooms/${room.body.id}`).expect(403);
    await ada.delete(`/api/rooms/${room.body.id}`).expect(204);
  });
});

describe('message history', () => {
  test('room history is only readable by members', async () => {
    const { agent: ada } = await signUp(server.app, 'ada');
    const { agent: eve } = await signUp(server.app, 'eve');
    const room = await ada.post('/api/rooms').send({ name: 'Engine', password: 'difference' }).expect(201);
    await ada.get(`/api/messages?room=${room.body.id}`).expect(200);
    await eve.get(`/api/messages?room=${room.body.id}`).expect(403);
  });

  test('exactly one of with/room is required', async () => {
    const { agent } = await signUp(server.app, 'ada');
    await agent.get('/api/messages').expect(400);
  });
});

test('unknown API routes return JSON 404s', async () => {
  const res = await request(server.app).get('/api/nope').expect(404);
  expect(res.body).toEqual({ error: 'Not found' });
});
