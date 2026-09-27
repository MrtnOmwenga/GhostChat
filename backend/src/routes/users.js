const express = require('express');
const User = require('../models/user');
const Room = require('../models/room');
const Message = require('../models/message');
const KeyEntry = require('../models/keyEntry');
const Joi = require('joi');
const { tombstone, checkDeletion } = require('../services/chain');
const { leaveRoom } = require('./rooms');
const schemas = require('../validation');
const { validate, HttpError } = require('../errors');
const { requireAuth, clearSessionCookie } = require('../auth');

const router = express.Router();
router.use(requireAuth);

// Prefix search on usernames. The pattern is limited to [A-Za-z0-9 _-], so it can't carry regex
// syntax into the query.
router.get('/search', async (req, res) => {
  const { q } = validate(schemas.search, req.query);
  const users = await User.find({ username: { $regex: `^${q}`, $options: 'i' }, _id: { $ne: req.user.id } })
    .limit(20);
  res.json(users);
});

// A user's full key history, oldest first, exactly as signed. Clients verify it themselves
// (docs/DESIGN.md §5.2); usernames can't change in v3 because they're bound to these keys.
router.get('/:id/keys', async (req, res) => {
  const id = validate(schemas.objectId, req.params.id);
  const entries = await KeyEntry.find({ user: id }).sort({ version: 1 });
  if (entries.length === 0) throw new HttpError(404, 'No such user');
  res.json(entries.map((e) => e.entry));
});

// Deleting an account: the account and its vault go; every message it sent becomes a tombstone
// carrying the user's signed deletion (content erased, chain links kept, so other people's history
// still verifies); it leaves every room, forcing a new room key. The public key history stays:
// it is what lets others verify those signatures, and the transparency log is append-only.
router.delete('/me', async (req, res) => {
  const me = req.user.id;
  const { deletion } = validate(Joi.object({ deletion: Joi.object().required() }), req.body || {});
  const problem = await checkDeletion(deletion, me);
  if (problem) throw new HttpError(400, problem);
  if (deletion.type !== 'account-deleted') throw new HttpError(400, 'expected an account deletion');

  const sent = await Message.find({ sender: me, 'envelope.deleted': { $exists: false } });
  await Promise.all(sent.map((m) => Message.updateOne({ _id: m._id }, { $set: { envelope: tombstone(m.envelope, deletion) } })));
  const realtime = req.app.get('realtime');
  for (const room of await Room.find({ members: me })) {
    // eslint-disable-next-line no-await-in-loop
    await leaveRoom(room, me, realtime);
  }
  await User.deleteOne({ _id: me });
  realtime?.disconnectUser(me);
  clearSessionCookie(res);
  res.status(204).end();
});

module.exports = router;
