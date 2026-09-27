const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
}, { timestamps: true });

roomSchema.set('toJSON', {
  transform: (doc, ret) => ({ id: ret._id.toString(), name: ret.name, creator: ret.creator.toString() }),
});

module.exports = mongoose.model('Room', roomSchema);
