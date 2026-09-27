const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const Room = require('../models/room');
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
  if (changes.password) update.passwordHash = await bcrypt.hash(changes.password, 12);
  const user = await User.findByIdAndUpdate(req.user.id, update, { returnDocument: 'after', runValidators: true });
  if (!user) throw new HttpError(404, 'Account not found');
  setSessionCookie(res, user); // the session carries the username
  res.json(user);
});

router.delete('/me', async (req, res) => {
  await User.deleteOne({ _id: req.user.id });
  await Room.updateMany({ members: req.user.id }, { $pull: { members: req.user.id } });
  clearSessionCookie(res);
  res.status(204).end();
});

module.exports = router;
