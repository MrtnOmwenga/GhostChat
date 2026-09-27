/*
 * The key transparency log (docs/DESIGN.md §5.3): every key-history entry is appended to a
 * Merkle tree whose heads the server signs. Clients check that the keys they use are in the log
 * (inclusion proofs) and that the log only ever grew (consistency proofs), so the server can't show
 * different people different keys, or quietly rewrite what it showed before.
 *
 * The tree is recomputed from stored leaf hashes on each request, which is fine at this scale; a
 * large deployment would cache interior nodes.
 */
const crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('../config');
const LogLeaf = require('../models/logLeaf');
const KeyEntry = require('../models/keyEntry');
const User = require('../models/user');
const { canonical, objectHash } = require('../crypto');
const merkle = require('./merkle');

const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

// The log's signing key comes from LOG_SIGNING_KEY (64 hex characters) or, if unset, is derived
// from JWT_SECRET so every deployment has a stable key without extra configuration.
const seed = config.logSigningKey
  ? Buffer.from(config.logSigningKey, 'hex')
  : crypto.createHmac('sha256', config.jwtSecret).update('ghostchat/log-signing-key').digest();
const privateKey = crypto.createPrivateKey({ key: Buffer.concat([PKCS8_ED25519_PREFIX, seed]), format: 'der', type: 'pkcs8' });
const publicKey = crypto.createPublicKey(privateKey).export({ format: 'jwk' }).x;

const counters = () => mongoose.connection.collection('counters');

async function append(userId, username, entry) {
  const data = { username, entry };
  const leafHash = merkle.leafHash(Buffer.from(canonical(data))).toString('hex');
  const { seq } = await counters().findOneAndUpdate(
    { _id: 'log' }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' },
  );
  await LogLeaf.create({
    _id: seq - 1, user: userId, version: entry.version, data, leafHash,
  });
}

/** Appends key entries that aren't in the log yet (e.g. created before the log existed). */
async function backfill() {
  const logged = new Set((await LogLeaf.find({}, { user: 1, version: 1 })).map((l) => `${l.user}:${l.version}`));
  const missing = (await KeyEntry.find().sort({ createdAt: 1 })).filter((k) => !logged.has(`${k.user}:${k.version}`));
  for (const k of missing) {
    // eslint-disable-next-line no-await-in-loop
    await append(k.user, k.entry.username, k.entry);
  }
}

async function leafHashes(size) {
  const leaves = await LogLeaf.find(size === undefined ? {} : { _id: { $lt: size } }, { leafHash: 1 }).sort({ _id: 1 });
  return leaves.map((l) => Buffer.from(l.leafHash, 'hex'));
}

function signHead(size, rootHash) {
  const head = {
    v: 1, size, rootHash, timestamp: new Date().toISOString(),
  };
  return { ...head, signature: crypto.sign(null, Buffer.from(objectHash(head)), privateKey).toString('base64url') };
}

async function head(size) {
  const leaves = await leafHashes(size);
  if (size !== undefined && leaves.length !== size) return null;
  return signHead(leaves.length, merkle.root(leaves).toString('hex'));
}

/** A user's log leaves with inclusion proofs against the current head. */
async function userProofs(userId) {
  const leaves = await leafHashes();
  const current = signHead(leaves.length, merkle.root(leaves).toString('hex'));
  const mine = await LogLeaf.find({ user: userId }).sort({ version: 1 });
  return {
    head: current,
    leaves: mine.map((l) => ({
      index: l._id,
      version: l.version,
      leafHash: l.leafHash,
      proof: merkle.inclusionProof(l._id, leaves).map((h) => h.toString('hex')),
    })),
  };
}

async function consistency(from, to) {
  const leaves = await leafHashes(to);
  if (from > to || leaves.length !== to) return null;
  return merkle.consistencyProof(from, leaves).map((h) => h.toString('hex'));
}

async function recent(limit = 50) {
  const leaves = await LogLeaf.find().sort({ _id: -1 }).limit(limit);
  const active = new Set((await User.find({ _id: { $in: leaves.map((l) => l.user) } }, { _id: 1 })).map((u) => u.id));
  return leaves.map((l) => ({
    index: l._id,
    username: l.data.username,
    version: l.version,
    type: l.data.entry.type,
    createdAt: l.data.entry.createdAt,
    leafHash: l.leafHash,
    accountActive: active.has(l.user.toString()),
  }));
}

module.exports = {
  append, backfill, head, userProofs, consistency, recent, publicKey, leafHashes,
};
