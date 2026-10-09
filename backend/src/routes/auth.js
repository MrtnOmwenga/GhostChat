const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const User = require('../models/user');
const KeyEntry = require('../models/keyEntry');
const Challenge = require('../models/challenge');
const schemas = require('../validation');
const { validate, HttpError } = require('../errors');
const {
  startSession, clearSessionCookie, requireAuth, sessionFromCookieHeader, endSessions,
} = require('../auth');
const { checkKeyEntry, verifySignature } = require('../crypto');
const log = require('../services/log');

const router = express.Router();

const DUMMY_HASH = bcrypt.hashSync('not-a-real-auth-key', config.bcryptRounds);

// Guessing passwords (or recovery phrases) is the main attack on these endpoints, so they share a
// much tighter budget than the rest of the API.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.rateLimits.authPer15Min,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts, try again later' },
});

// Unknown usernames get a stable, fake salt derived from the server secret, so this endpoint
// doesn't reveal which usernames exist.
router.get('/salt', async (req, res) => {
  const { username } = validate(schemas.usernameQuery, req.query);
  const user = await User.findOne({ username }, { salt: 1 });
  const salt = user ? user.salt : crypto.createHmac('sha256', config.jwtSecret).update(`salt:${username}`).digest()
    .subarray(0, 16).toString('base64url');
  res.json({ salt });
});

// The client sends the first half of its Argon2id output (authKey), never the password, plus its
// vault and first key-history entry. The entry is checked here exactly as contacts will check it.
router.post('/register', authLimiter, async (req, res) => {
  const body = validate(schemas.register, req.body);
  const problem = checkKeyEntry(body.keyEntry, null, body.username);
  if (problem) throw new HttpError(400, problem);

  const user = await User.create({
    username: body.username,
    did: body.keyEntry.did,
    salt: body.salt,
    authHash: await bcrypt.hash(body.authKey, config.bcryptRounds),
    vault: body.vault,
  });
  await KeyEntry.create({ user: user.id, version: 1, entry: body.keyEntry });
  await log.append(user.id, user.username, body.keyEntry);
  await startSession(res, user);
  res.status(201).json(user);
});

router.post('/login', authLimiter, async (req, res) => {
  const { username, authKey } = validate(schemas.login, req.body);
  const user = await User.findOne({ username });
  // Compare against a dummy hash for unknown users so response time doesn't reveal which exist.
  const ok = await bcrypt.compare(authKey, user ? user.authHash : DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'Incorrect username or password');
  await startSession(res, user);
  res.json({ user, vault: user.vault });
});

// Signing out ends the session on the server, not only in this browser: the row is deleted, so
// a copy of the cookie stops working, and the session's open sockets are closed.
router.post('/logout', async (req, res) => {
  const session = await sessionFromCookieHeader(req.headers.cookie);
  if (session) await endSessions({ _id: session.sessionId }, req.app.get('realtime'));
  clearSessionCookie(res);
  res.status(204).end();
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(401, 'Not signed in');
  res.json(user);
});

// For a signed-in browser that has lost its cached keys: it re-derives the vault key from the
// password and unlocks this.
router.get('/vault', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(401, 'Not signed in');
  res.json({ salt: user.salt, vault: user.vault });
});

router.post('/password', requireAuth, authLimiter, async (req, res) => {
  const body = validate(schemas.passwordChange, req.body);
  const user = await User.findById(req.user.id);
  if (!user || !(await bcrypt.compare(body.currentAuthKey, user.authHash))) {
    throw new HttpError(401, 'Current password is incorrect');
  }
  user.salt = body.salt;
  user.authHash = await bcrypt.hash(body.authKey, config.bcryptRounds);
  user.vault = body.vault;
  await user.save();
  // Whoever else is signed in as this user was signed in with the old password.
  await endSessions({ user: user.id, _id: { $ne: req.user.sessionId } }, req.app.get('realtime'));
  res.status(204).end();
});

// Forgotten password: the client regenerates its keys from the recovery phrase and proves it by
// signing a fresh, single-use challenge with the current signing key.
router.get('/recovery/challenge', authLimiter, async (req, res) => {
  const { username } = validate(schemas.usernameQuery, req.query);
  const user = await User.findOne({ username });
  if (!user) throw new HttpError(404, 'No account with that username');
  const challenge = await Challenge.create({ user: user.id, value: crypto.randomBytes(32).toString('hex') });
  const entries = await KeyEntry.find({ user: user.id }).sort({ version: 1 });
  res.json({ challenge: challenge.value, keyHistory: entries.map((e) => e.entry) });
});

router.post('/recovery', authLimiter, async (req, res) => {
  const body = validate(schemas.recovery, req.body);
  const user = await User.findOne({ username: body.username });
  const challenge = user && await Challenge.findOneAndDelete({ user: user.id, value: body.challenge });
  if (!challenge) throw new HttpError(401, 'Recovery challenge expired; start again');
  const current = (await KeyEntry.findOne({ user: user.id }).sort({ version: -1 })).entry;
  if (!verifySignature(current.signingKey, `ghostchat-recovery:${body.challenge}`, body.signature)) {
    throw new HttpError(401, 'That recovery phrase does not match this account');
  }
  user.salt = body.salt;
  user.authHash = await bcrypt.hash(body.authKey, config.bcryptRounds);
  user.vault = body.vault;
  await user.save();
  await endSessions({ user: user.id }, req.app.get('realtime'));
  await startSession(res, user);
  res.json({ user });
});

module.exports = router;
