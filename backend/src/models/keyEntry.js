const mongoose = require('mongoose');

// One signed entry of a user's key history (see docs/DESIGN.md §5.2). Stored exactly as signed.
const keyEntrySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  version: { type: Number, required: true },
  entry: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

keyEntrySchema.index({ user: 1, version: 1 }, { unique: true });

module.exports = mongoose.model('KeyEntry', keyEntrySchema);
