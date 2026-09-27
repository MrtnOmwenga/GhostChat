const mongoose = require('mongoose');

// One entry of the key transparency log (docs/DESIGN.md §5.3). Append-only: nothing updates or
// deletes these, including account deletion.
const logLeafSchema = new mongoose.Schema({
  _id: { type: Number }, // position in the log, from 0
  user: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  version: { type: Number, required: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true }, // { username, entry }, exactly as hashed
  leafHash: { type: String, required: true },
}, { timestamps: { createdAt: true, updatedAt: false }, collection: 'logleaves' });

logLeafSchema.index({ user: 1, version: 1 }, { unique: true });

module.exports = mongoose.model('LogLeaf', logLeafSchema);
