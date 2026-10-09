const mongoose = require('mongoose');

// One row per signed-in browser. The cookie names its row; deleting the row ends the session at
// once, wherever a copy of the cookie is. MongoDB's TTL index removes rows as they expire.
const sessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, expires: 0 },
});

module.exports = mongoose.model('Session', sessionSchema);
