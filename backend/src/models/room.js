const crypto = require('crypto');
const mongoose = require('mongoose');

// Rooms are identified by a random ID; the name is only a label and doesn't need to be unique.
// `epoch` counts room keys: it increases every time the key is replaced (docs/DESIGN.md §7).
const roomSchema = new mongoose.Schema({
  _id: { type: String, default: () => crypto.randomBytes(16).toString('hex') },
  name: { type: String, required: true },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
  epoch: { type: Number, default: 1 },
  rotationPending: { type: Boolean, default: false },
}, { timestamps: true });

roomSchema.set('toJSON', {
  transform: (doc, ret) => ({
    id: ret._id,
    name: ret.name,
    creator: ret.creator.toString(),
    // Populated members arrive already shaped by the User model's toJSON ({ id, username, … }).
    members: ret.members.map((m) => (m && m.username ? { id: m.id || m._id.toString(), username: m.username } : m.toString())),
    epoch: ret.epoch,
    rotationPending: ret.rotationPending,
  }),
});

module.exports = mongoose.model('Room', roomSchema);
