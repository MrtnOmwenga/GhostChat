const mongoose = require('mongoose');

// Single-use recovery challenges; MongoDB's TTL index removes them after five minutes.
const challengeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  value: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now, expires: 300 },
});

module.exports = mongoose.model('Challenge', challengeSchema);
