const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const User = require('../models/user');
const schemas = require('../validation');
const { validate, HttpError } = require('../errors');
const { setSessionCookie, clearSessionCookie, requireAuth } = require('../auth');

const router = express.Router();

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

// Brute-forcing passwords is the main attack on these two endpoints, so they get a much tighter
// budget than the rest of the API.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.rateLimits.authPer15Min,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts, try again later' },
});

router.post('/register', authLimiter, async (req, res) => {
  const { username, password } = validate(schemas.credentials, req.body);
  const user = await User.create({ username, passwordHash: await bcrypt.hash(password, 12) });
  setSessionCookie(res, user);
  res.status(201).json(user);
});

router.post('/login', authLimiter, async (req, res) => {
  const { username, password } = validate(schemas.credentials, req.body);
  const user = await User.findOne({ username });
  // Compare against a dummy hash when the user doesn't exist, so response time doesn't reveal
  // which usernames are registered.
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) throw new HttpError(401, 'Incorrect username or password');
  setSessionCookie(res, user);
  res.json(user);
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(401, 'Not signed in');
  res.json(user);
});

module.exports = router;
