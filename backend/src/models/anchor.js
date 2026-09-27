const mongoose = require('mongoose');

// A log root timestamped on Bitcoin through OpenTimestamps calendars (docs/DESIGN.md §5.3).
const anchorSchema = new mongoose.Schema({
  size: { type: Number, required: true },
  rootHash: { type: String, required: true },
  timestamp: { type: String, required: true }, // hex: the serialized OpenTimestamps proof tree
  bitcoin: { height: Number, verified: Boolean, checkedAt: Date },
}, { timestamps: true });

anchorSchema.set('toJSON', {
  transform: (doc, ret) => ({
    id: ret._id.toString(),
    size: ret.size,
    rootHash: ret.rootHash,
    createdAt: ret.createdAt,
    status: ret.bitcoin?.verified ? 'confirmed' : 'pending',
    bitcoinHeight: ret.bitcoin?.height ?? null,
  }),
});

module.exports = mongoose.model('Anchor', anchorSchema);
