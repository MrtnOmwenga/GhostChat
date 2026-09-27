const mongoose = require('mongoose');

// A message goes either to one user (`to`) or to a room (`room`), never both.
const messageSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Copied at send time so history renders without a join, and still shows a name after the
  // sender deletes their account.
  fromUsername: { type: String, required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  text: { type: String, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

messageSchema.index({ from: 1, to: 1, createdAt: -1 });
messageSchema.index({ room: 1, createdAt: -1 });

messageSchema.set('toJSON', {
  transform: (doc, ret) => ({
    id: ret._id.toString(),
    from: { id: ret.from.toString(), username: ret.fromUsername },
    to: ret.to ? ret.to.toString() : undefined,
    room: ret.room ? ret.room.toString() : undefined,
    text: ret.text,
    createdAt: ret.createdAt,
  }),
});

module.exports = mongoose.model('Message', messageSchema);
