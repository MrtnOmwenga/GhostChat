const request = require('supertest');
const crypto = require('crypto');
const {
  startServer, signUp, makeAccount, randomB64, signedDeletion, nextEntry, keyPair, keyCommitment,
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

  test('signing out ends the session on the server: a copy of the cookie stops working', async () => {
    const { agent, cookie } = await signUp(server.app, 'ada');
    const elsewhere = () => request(server.app).get('/api/auth/me').set('Cookie', cookie);
    await elsewhere().expect(200);
    await agent.post('/api/auth/logout').expect(204);
    await elsewhere().expect(401);
  });

  test('each sign-in is its own session; signing out of one leaves the other', async () => {
    const { account } = await signUp(server.app, 'ada');
    const login = async () => {
      const agent = request.agent(server.app);
      await agent.post('/api/auth/login').send({ username: 'ada', authKey: account.body.authKey }).expect(200);
      return agent;
    };
    const [laptop, phone] = [await login(), await login()];
    await laptop.post('/api/auth/logout').expect(204);
    await laptop.get('/api/auth/me').expect(401);
    await phone.get('/api/auth/me').expect(200);
  });

  test('a session token is refused once its row is gone, or if it names no session', async () => {
    const { cookie, user } = await signUp(server.app, 'ada');
    const jwt = require('jsonwebtoken');
    const config = require('../src/config');
    const signed = (claims) => `ghostchat_session=${jwt.sign(claims, config.jwtSecret, { algorithm: 'HS256', expiresIn: '1h' })}`;
    const me = (c) => request(server.app).get('/api/auth/me').set('Cookie', c);
    // Correctly signed, as the server before sessions were rows would have issued it.
    await me(signed({ sub: user.id, username: 'ada' })).expect(401);
    await me(signed({ sub: user.id, username: 'ada', sid: 'not-an-id' })).expect(401);
    await me(signed({ sub: user.id, username: 'ada', sid: '0123456789abcdef01234567' })).expect(401);
    // Someone else's session can't be claimed under another user's name.
    const other = await signUp(server.app, 'grace');
    const theirs = jwt.decode(other.cookie.split('=')[1]).sid;
    await me(signed({ sub: user.id, username: 'ada', sid: theirs })).expect(401);
    await me(cookie).expect(200);
    await require('../src/models/session').deleteMany({ user: user.id });
    await me(cookie).expect(401);
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

  test('changing the password signs out every other device, and keeps this one', async () => {
    const { agent, account } = await signUp(server.app, 'ada');
    const other = request.agent(server.app);
    await other.post('/api/auth/login').send({ username: 'ada', authKey: account.body.authKey }).expect(200);
    const change = { salt: randomB64(16), authKey: randomB64(32), vault: { nonce: randomB64(24), ciphertext: randomB64(90) } };
    await agent.post('/api/auth/password').send({ ...change, currentAuthKey: account.body.authKey }).expect(204);
    await agent.get('/api/auth/me').expect(200);
    await other.get('/api/auth/me').expect(401);
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

  test('recovering an account ends every session that was open on it', async () => {
    const { agent, account } = await signUp(server.app, 'ada');
    const { body } = await request(server.app).get('/api/auth/recovery/challenge?username=ada');
    const signature = crypto.sign(null, Buffer.from(`ghostchat-recovery:${body.challenge}`), account.signing.privateKey).toString('base64url');
    const recovered = request.agent(server.app);
    await recovered.post('/api/auth/recovery').send({
      username: 'ada', challenge: body.challenge, signature, salt: randomB64(16), authKey: randomB64(32), vault: { nonce: randomB64(24), ciphertext: randomB64(90) },
    }).expect(200);
    await agent.get('/api/auth/me').expect(401);
    await recovered.get('/api/auth/me').expect(200);
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

  test('deleting an account needs its signed deletion; the account goes, the key history stays', async () => {
    const ada = await signUp(server.app, 'ada');
    const grace = await signUp(server.app, 'grace');
    await ada.agent.delete(`/api/users/${grace.user.id}`).expect(404);
    await ada.agent.delete('/api/users/me').send({}).expect(400);
    await ada.agent.delete('/api/users/me').send({ deletion: signedDeletion(grace, { type: 'account-deleted' }) }).expect(400);
    await ada.agent.delete('/api/users/me').send({ deletion: signedDeletion(ada, { type: 'account-deleted' }) }).expect(204);
    await request(server.app).post('/api/auth/login').send({ username: 'ada', authKey: ada.account.body.authKey }).expect(401);
    // Public keys remain so others can still verify ada's old signatures.
    expect((await grace.agent.get(`/api/users/${ada.user.id}/keys`).expect(200)).body).toEqual([ada.account.entry]);
  });
});

describe('verified-contact marks', () => {
  const blob = () => ({ nonce: randomB64(24), ciphertext: randomB64(120) });

  test('the encrypted marks are stored per account and returned to its other devices', async () => {
    const ada = await signUp(server.app, 'ada');
    expect((await ada.agent.get('/api/users/me/pins').expect(200)).body).toEqual({ nonce: null, ciphertext: null, version: 0 });
    const first = blob();
    expect((await ada.agent.put('/api/users/me/pins').send({ ...first, baseVersion: 0 }).expect(200)).body).toEqual({ version: 1 });

    const phone = request.agent(server.app);
    await phone.post('/api/auth/login').send({ username: 'ada', authKey: ada.account.body.authKey }).expect(200);
    expect((await phone.get('/api/users/me/pins').expect(200)).body).toEqual({ ...first, version: 1 });

    const grace = await signUp(server.app, 'grace');
    expect((await grace.agent.get('/api/users/me/pins').expect(200)).body.version).toBe(0);
    await request(server.app).get('/api/users/me/pins').expect(401);
  });

  test("two devices changing them at once can't drop each other's change", async () => {
    const ada = await signUp(server.app, 'ada');
    await ada.agent.put('/api/users/me/pins').send({ ...blob(), baseVersion: 0 }).expect(200);
    const mine = blob();
    // Both devices read version 1; the first write wins, the second is told to re-read.
    await ada.agent.put('/api/users/me/pins').send({ ...mine, baseVersion: 1 }).expect(200);
    await ada.agent.put('/api/users/me/pins').send({ ...blob(), baseVersion: 1 }).expect(409);
    await ada.agent.put('/api/users/me/pins').send({ ...blob(), baseVersion: 0 }).expect(409);
    expect((await ada.agent.get('/api/users/me/pins').expect(200)).body).toEqual({ ...mine, version: 2 });
  });

  test('malformed or oversized marks are refused, and they never appear in what others see of the user', async () => {
    const ada = await signUp(server.app, 'ada');
    const grace = await signUp(server.app, 'grace');
    await ada.agent.put('/api/users/me/pins').send({ nonce: 'short', ciphertext: randomB64(30), baseVersion: 0 }).expect(400);
    await ada.agent.put('/api/users/me/pins').send({ ...blob(), ciphertext: 'not base64!', baseVersion: 0 }).expect(400);
    await ada.agent.put('/api/users/me/pins').send({ ...blob(), ciphertext: 'A'.repeat(60_000), baseVersion: 0 }).expect(400);
    await ada.agent.put('/api/users/me/pins').send({ ...blob(), baseVersion: 0 }).expect(200);
    const found = await grace.agent.get('/api/users/search?q=ada').expect(200);
    expect(JSON.stringify(found.body)).not.toMatch(/pins|ciphertext/);
  });
});

describe('key rotation and reset', () => {
  const vault = () => ({ nonce: randomB64(24), ciphertext: randomB64(90) });

  test('a rotation must be signed by the previous key and match its commitment', async () => {
    const { agent, account, user } = await signUp(server.app, 'ada');
    const future = keyPair('ed25519').publicKey;
    const honest = nextEntry(account.entry, {
      type: 'rotate', signWith: account.signing.privateKey, signingKey: account.next.publicKey, nextKeyCommitment: keyCommitment(future),
    });
    const stolenKeyAttack = nextEntry(account.entry, {
      type: 'rotate', signWith: account.signing.privateKey, signingKey: keyPair('ed25519').publicKey, nextKeyCommitment: keyCommitment(future),
    });
    const post = (entry, currentAuthKey = account.body.authKey) => agent.post('/api/keys/rotate').send({ currentAuthKey, entry, vault: vault() });

    await post(honest, randomB64(32)).expect(401);
    expect((await post(stolenKeyAttack).expect(400)).body.error).toMatch(/pre-rotation commitment/);
    await post(honest).expect(201);
    const history = (await agent.get(`/api/users/${user.id}/keys`)).body;
    expect(history.map((e) => [e.version, e.type])).toEqual([[1, 'create'], [2, 'rotate']]);
    await post(honest).expect(400); // version out of sequence now
  });

  test('a reset is self-signed and needs the password', async () => {
    const { agent, account } = await signUp(server.app, 'ada');
    const fresh = keyPair('ed25519');
    const reset = nextEntry(account.entry, {
      type: 'reset', signWith: fresh.privateKey, signingKey: fresh.publicKey, nextKeyCommitment: keyCommitment(keyPair('ed25519').publicKey),
    });
    await agent.post('/api/keys/rotate').send({ currentAuthKey: account.body.authKey, entry: reset, vault: vault() }).expect(400);
    await agent.post('/api/keys/reset').send({ currentAuthKey: account.body.authKey, entry: reset, vault: vault() }).expect(201);
  });
});

test('unknown API routes return JSON 404s', async () => {
  const res = await request(server.app).get('/api/nope').expect(404);
  expect(res.body).toEqual({ error: 'Not found' });
});
