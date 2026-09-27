const mongoose = require('mongoose');

// The latest signed read receipt of one reader in one conversation (docs/DESIGN.md §6.4).
const receiptSchema = new mongoose.Schema({
  conversation: { type: String, required: true },
  reader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  upToSeq: { type: Number, required: true },
  receipt: { type: mongoose.Schema.Types.Mixed, required: true },
});

receiptSchema.index({ conversation: 1, reader: 1 }, { unique: true });

receiptSchema.set('toJSON', { transform: (doc, ret) => ret.receipt });

module.exports = mongoose.model('Receipt', receiptSchema);
