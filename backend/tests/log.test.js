const crypto = require('crypto');
const request = require('supertest');
const { startServer, signUp, nextEntry, keyPair, keyCommitment, randomB64 } = require('./helpers');
const merkle = require('../src/services/merkle');
const { canonical, objectHash } = require('../src/crypto');
const anchoring = require('../src/services/anchoring');
const calendarFixture = require('../../test-vectors/ots/calendar-responses.json');

let server;
beforeAll(async () => { server = await startServer(); });
afterEach(async () => {
  jest.restoreAllMocks();
  await server.reset();
});
afterAll(async () => { await server.stop(); });

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const verifyHead = (head, publicKeyB64) => crypto.verify(
  null,
  Buffer.from(objectHash(head)),
  crypto.createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyB64, 'base64url')]), format: 'der', type: 'spki' }),
  Buffer.from(head.signature, 'base64url'),
);

test('every key entry is in the log, provably, under a head signed by the log key', async () => {
  const ada = await signUp(server.app, 'ada');
  await signUp(server.app, 'grace');
  const { publicKey } = (await request(server.app).get('/api/log/key').expect(200)).body;
  const { head, leaves } = (await ada.agent.get(`/api/log/users/${ada.user.id}`).expect(200)).body;

  expect(head.size).toBe(2);
  expect(verifyHead(head, publicKey)).toBe(true);
  expect(verifyHead({ ...head, size: 3 }, publicKey)).toBe(false);
  const [leaf] = leaves;
  const expectedLeaf = merkle.leafHash(Buffer.from(canonical({ username: 'ada', entry: ada.account.entry })));
  expect(leaf.leafHash).toBe(expectedLeaf.toString('hex'));
  expect(merkle.verifyInclusion(expectedLeaf, leaf.index, head.size, leaf.proof.map((h) => Buffer.from(h, 'hex')), Buffer.from(head.rootHash, 'hex'))).toBe(true);
});

test('the log only grows: old heads are consistent with new ones after a rotation', async () => {
  const ada = await signUp(server.app, 'ada');
  const before = (await request(server.app).get('/api/log/head')).body;
  const rotation = nextEntry(ada.account.entry, {
    type: 'rotate', signWith: ada.account.signing.privateKey, signingKey: ada.account.next.publicKey, nextKeyCommitment: keyCommitment(keyPair('ed25519').publicKey),
  });
  await ada.agent.post('/api/keys/rotate').send({ currentAuthKey: ada.account.body.authKey, entry: rotation, vault: { nonce: randomB64(24), ciphertext: randomB64(90) } }).expect(201);
  await signUp(server.app, 'grace');
  const after = (await request(server.app).get('/api/log/head')).body;
  expect(after.size).toBe(3);

  const { proof } = (await request(server.app).get(`/api/log/consistency?from=${before.size}&to=${after.size}`)).body;
  const buf = (h) => Buffer.from(h, 'hex');
  expect(merkle.verifyConsistency(before.size, after.size, proof.map(buf), buf(before.rootHash), buf(after.rootHash))).toBe(true);
  expect((await request(server.app).get(`/api/log/head/${before.size}`)).body.rootHash).toBe(before.rootHash);

  const entries = (await request(server.app).get('/api/log/entries')).body;
  expect(entries.map((e) => [e.username, e.type, e.version])).toEqual([['grace', 'create', 1], ['ada', 'rotate', 2], ['ada', 'create', 1]]);
});

test('anchoring stamps the root with the calendars and serves an .ots proof', async () => {
  await signUp(server.app, 'ada');
  const responses = Object.values(calendarFixture.calendars).map((hex) => Buffer.from(hex, 'hex'));
  let call = 0;
  jest.spyOn(global, 'fetch').mockImplementation(async () => new Response(responses[call++ % responses.length]));
  const anchor = await anchoring.stamp();
  expect(anchor.toJSON()).toMatchObject({ size: 1, status: 'pending', bitcoinHeight: null });

  const list = (await request(server.app).get('/api/log/anchors').expect(200)).body;
  expect(list).toHaveLength(1);
  const file = await request(server.app).get(`/api/log/anchors/${list[0].id}.ots`).buffer(true).parse((res, cb) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => cb(null, Buffer.concat(chunks)));
  }).expect(200);
  expect(file.body.subarray(1, 15).toString()).toBe('OpenTimestamps');
  expect(file.body.includes(Buffer.from(list[0].rootHash, 'hex'))).toBe(true);
});
