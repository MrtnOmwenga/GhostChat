const mongoose = require('mongoose');

// One member's copy of one epoch's room key, sealed to that member's encryption key.
const roomKeySchema = new mongoose.Schema({
  room: { type: String, ref: 'Room', required: true },
  epoch: { type: Number, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  keyVersion: { type: Number, required: true },
  sealed: { type: String, required: true },
});

roomKeySchema.index({ room: 1, epoch: 1, user: 1 }, { unique: true });
roomKeySchema.index({ user: 1 });

roomKeySchema.set('toJSON', {
  transform: (doc, ret) => ({ epoch: ret.epoch, keyVersion: ret.keyVersion, sealed: ret.sealed }),
});

module.exports = mongoose.model('RoomKey', roomKeySchema);
