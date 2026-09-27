const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const KeyEntry = require('../models/keyEntry');
const { validate, HttpError } = require('../errors');
const { requireAuth } = require('../auth');
const { checkKeyEntry } = require('../crypto');
const log = require('../services/log');

const router = express.Router();
router.use(requireAuth);

const b64 = (bytes) => Joi.string().pattern(/^[A-Za-z0-9_-]+$/).length(Math.ceil((bytes * 4) / 3));
const change = Joi.object({
  currentAuthKey: b64(32).required(),
  entry: Joi.object().unknown(true).required(),
  vault: Joi.object({ nonce: b64(24).required(), ciphertext: Joi.string().pattern(/^[A-Za-z0-9_-]+$/).max(65536).required() }).required(),
});

/**
 * Appends a key-history entry: a rotation (signed by the previous key and matching its
 * pre-rotation commitment) or a reset (self-signed, shown to contacts as a warning). The password
 * proof guards the vault replacement that comes with it (docs/DESIGN.md §5.2).
 */
async function appendKeyEntry(req, res, type) {
  const body = validate(change, req.body);
  const user = await User.findById(req.user.id);
  if (!user || !(await bcrypt.compare(body.currentAuthKey, user.authHash))) throw new HttpError(401, 'Incorrect password');
  if (body.entry.type !== type) throw new HttpError(400, `expected a ${type} entry`);
  const previous = (await KeyEntry.findOne({ user: user.id }).sort({ version: -1 })).entry;
  const problem = checkKeyEntry(body.entry, previous, user.username);
  if (problem) throw new HttpError(400, problem);
  try {
    await KeyEntry.create({ user: user.id, version: body.entry.version, entry: body.entry });
  } catch (err) {
    if (err.code === 11000) throw new HttpError(409, 'Your keys changed on another device; reload');
    throw err;
  }
  await log.append(user.id, user.username, body.entry);
  user.vault = body.vault;
  await user.save();
  req.app.get('realtime')?.keysChanged(user.id, body.entry.version);
  res.status(201).json(body.entry);
}

router.post('/rotate', (req, res) => appendKeyEntry(req, res, 'rotate'));
router.post('/reset', (req, res) => appendKeyEntry(req, res, 'reset'));

module.exports = router;
