const express = require('express');
const User = require('../models/user');
const Room = require('../models/room');
const Message = require('../models/message');
const KeyEntry = require('../models/keyEntry');
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

// Deleting an account removes everything that identifies the user: the account, every message
// they sent (direct and in rooms), their room memberships, and rooms nobody else is in.
router.delete('/me', async (req, res) => {
  const me = req.user.id;
  await Message.deleteMany({ from: me });
  await Room.updateMany({ members: me }, { $pull: { members: me } });
  await Room.deleteMany({ members: { $size: 0 } });
  // Rooms they created that still have members pass to the longest-standing remaining member.
  await Room.updateMany({ creator: me }, [{ $set: { creator: { $arrayElemAt: ['$members', 0] } } }], { updatePipeline: true });
  await KeyEntry.deleteMany({ user: me });
  await User.deleteOne({ _id: me });
  req.app.get('realtime')?.disconnectUser(me);
  clearSessionCookie(res);
  res.status(204).end();
});

module.exports = router;
