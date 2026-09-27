const express = require('express');
const bcrypt = require('bcryptjs');
const config = require('../config');
const User = require('../models/user');
const Room = require('../models/room');
const Message = require('../models/message');
const schemas = require('../validation');
const { validate, HttpError } = require('../errors');
const { requireAuth, setSessionCookie, clearSessionCookie } = require('../auth');

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

// Accounts are only ever changed by their owner, so there are no /users/:id write routes.
router.patch('/me', async (req, res) => {
  const changes = validate(schemas.profileUpdate, req.body);
  const update = {};
  if (changes.username) update.username = changes.username;
  if (changes.password) update.passwordHash = await bcrypt.hash(changes.password, config.bcryptRounds);
  const user = await User.findByIdAndUpdate(req.user.id, update, { returnDocument: 'after', runValidators: true });
  if (!user) throw new HttpError(404, 'Account not found');
  setSessionCookie(res, user); // the session carries the username
  res.json(user);
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
  await User.deleteOne({ _id: me });
  req.app.get('realtime')?.disconnectUser(me);
  clearSessionCookie(res);
  res.status(204).end();
});

module.exports = router;
