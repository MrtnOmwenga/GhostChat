const request = require('supertest');
const crypto = require('crypto');
const {
  startServer, signUp, makeAccount, randomB64,
} = require('./helpers');

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
  test('register stores the account and sets an httpOnly, SameSite=Strict session cookie', async () => {
    const { body } = makeAccount('ada');
    const res = await request(server.app).post('/api/auth/register').send(body).expect(201);
    expect(res.body).toEqual({ id: expect.any(String), username: 'ada', did: body.keyEntry.did, receiptsEnabled: false });
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
  });

  test('register rejects a forged, mismatched or malformed key entry', async () => {
    const { body } = makeAccount('ada');
    const post = (b) => request(server.app).post('/api/auth/register').send(b);
    await post({ ...body, keyEntry: { ...body.keyEntry, reason: 'edited' } }).expect(400);
    await post({ ...body, username: 'mallory' }).expect(400);
    await post({ ...body, keyEntry: { ...body.keyEntry, did: 'did:key:zNotMine' } }).expect(400);
    await post({ ...body, authKey: 'too-short' }).expect(400);
    await post({ ...body, username: { $gt: '' } }).expect(400);
  });

  test('duplicate usernames are rejected', async () => {
    await signUp(server.app, 'ada');
    await request(server.app).post('/api/auth/register').send(makeAccount('ada').body).expect(409);
  });

  test('the salt endpoint answers the same way for real and unknown usernames', async () => {
    const { account } = await signUp(server.app, 'ada');
    const real = await request(server.app).get('/api/auth/salt?username=ada').expect(200);
    expect(real.body.salt).toBe(account.body.salt);
    const fake1 = await request(server.app).get('/api/auth/salt?username=nobody').expect(200);
    const fake2 = await request(server.app).get('/api/auth/salt?username=nobody').expect(200);
    expect(fake1.body.salt).toBe(fake2.body.salt);
    expect(fake1.body.salt).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  test('login takes the authKey and returns the vault; me and logout', async () => {
    const { account } = await signUp(server.app, 'ada');
    const agent = request.agent(server.app);
    await agent.post('/api/auth/login').send({ username: 'ada', authKey: randomB64(32) }).expect(401);
    await agent.post('/api/auth/login').send({ username: 'nobody', authKey: randomB64(32) }).expect(401);
    const res = await agent.post('/api/auth/login').send({ username: 'ada', authKey: account.body.authKey }).expect(200);
    expect(res.body.vault).toEqual(account.body.vault);
    expect((await agent.get('/api/auth/vault').expect(200)).body.salt).toBe(account.body.salt);
    expect((await agent.get('/api/auth/me').expect(200)).body.username).toBe('ada');
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  test('a password change needs the current authKey and replaces salt, authKey and vault', async () => {
    const { agent, account } = await signUp(server.app, 'ada');
    const change = { salt: randomB64(16), authKey: randomB64(32), vault: { nonce: randomB64(24), ciphertext: randomB64(90) } };
    await agent.post('/api/auth/password').send({ ...change, currentAuthKey: randomB64(32) }).expect(401);
    await agent.post('/api/auth/password').send({ ...change, currentAuthKey: account.body.authKey }).expect(204);
    await request(server.app).post('/api/auth/login').send({ username: 'ada', authKey: account.body.authKey }).expect(401);
    const res = await request(server.app).post('/api/auth/login').send({ username: 'ada', authKey: change.authKey }).expect(200);
    expect(res.body.vault).toEqual(change.vault);
  });

  test('recovery needs a signature over a fresh challenge with the current signing key', async () => {
    const { account } = await signUp(server.app, 'ada');
    const recover = async (privateKey) => {
      const { body } = await request(server.app).get('/api/auth/recovery/challenge?username=ada').expect(200);
      expect(body.keyHistory).toEqual([account.entry]);
      const signature = crypto.sign(null, Buffer.from(`ghostchat-recovery:${body.challenge}`), privateKey).toString('base64url');
      const replacement = { salt: randomB64(16), authKey: randomB64(32), vault: { nonce: randomB64(24), ciphertext: randomB64(90) } };
      return request(server.app).post('/api/auth/recovery').send({ username: 'ada', challenge: body.challenge, signature, ...replacement });
    };
    expect((await recover(crypto.generateKeyPairSync('ed25519').privateKey)).status).toBe(401);
    const ok = await recover(account.signing.privateKey);
    expect(ok.status).toBe(200);
    expect(ok.headers['set-cookie'][0]).toMatch(/ghostchat_session=/);
  });

  test('a recovery challenge can only be used once', async () => {
    const { account } = await signUp(server.app, 'ada');
    const { body } = await request(server.app).get('/api/auth/recovery/challenge?username=ada');
    const signature = crypto.sign(null, Buffer.from(`ghostchat-recovery:${body.challenge}`), account.signing.privateKey).toString('base64url');
    const attempt = { username: 'ada', challenge: body.challenge, signature, salt: randomB64(16), authKey: randomB64(32), vault: { nonce: randomB64(24), ciphertext: randomB64(90) } };
    await request(server.app).post('/api/auth/recovery').send(attempt).expect(200);
    await request(server.app).post('/api/auth/recovery').send(attempt).expect(401);
  });

  test('a forged or tampered session is rejected', async () => {
    await request(server.app).get('/api/auth/me').set('Cookie', 'ghostchat_session=not-a-jwt').expect(401);
    const { cookie } = await signUp(server.app, 'ada');
    await request(server.app).get('/api/auth/me').set('Cookie', `${cookie.slice(0, -4)}AAAA`).expect(401);
  });
});

describe('users', () => {
  test('every route requires a session', async () => {
    await request(server.app).get('/api/users/search?q=a').expect(401);
    await request(server.app).delete('/api/users/me').expect(401);
  });

  test('search finds others by prefix, never the searcher, and leaks no secrets', async () => {
    const { agent } = await signUp(server.app, 'ada');
    await signUp(server.app, 'adam');
    await signUp(server.app, 'grace');
    const res = await agent.get('/api/users/search?q=ad').expect(200);
    expect(res.body.map((u) => u.username)).toEqual(['adam']);
    expect(Object.keys(res.body[0]).sort()).toEqual(['did', 'id', 'receiptsEnabled', 'username']);
  });

  test('search input cannot inject regex or operators', async () => {
    const { agent } = await signUp(server.app, 'ada');
    await agent.get('/api/users/search?q=.*').expect(400);
    await agent.get('/api/users/search?q[$ne]=x').expect(400);
  });

  test("anyone signed in can fetch a user's key history, exactly as signed", async () => {
    const { user, account } = await signUp(server.app, 'ada');
    const { agent } = await signUp(server.app, 'grace');
    expect((await agent.get(`/api/users/${user.id}/keys`).expect(200)).body).toEqual([account.entry]);
    await agent.get('/api/users/0123456789abcdef01234567/keys').expect(404);
  });

  test('users can only delete themselves, and deletion removes the account', async () => {
    const { agent, account } = await signUp(server.app, 'ada');
    const { user: grace } = await signUp(server.app, 'grace');
    await agent.delete(`/api/users/${grace.id}`).expect(404);
    await agent.delete('/api/users/me').expect(204);
    await request(server.app).post('/api/auth/login').send({ username: 'ada', authKey: account.body.authKey }).expect(401);
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
