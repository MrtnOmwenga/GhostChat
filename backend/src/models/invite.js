const crypto = require('crypto');
const mongoose = require('mongoose');

// An invite holds every epoch key of its room, encrypted under a key derived from the secret in
// the invite link's #fragment, which never reaches the server. Expired invites are removed by a
// TTL index; replacing the room key deletes a room's invites.
const inviteSchema = new mongoose.Schema({
  _id: { type: String, default: () => crypto.randomBytes(12).toString('hex') },
  room: { type: String, ref: 'Room', required: true, index: true },
  keys: [{ epoch: Number, nonce: String, ciphertext: String, _id: false }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  usesLeft: { type: Number, default: null },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

module.exports = mongoose.model('Invite', inviteSchema);
