const mongoose = require('mongoose');

/**
 * A signed, encrypted message envelope, stored exactly as the client signed it (docs/DESIGN.md
 * §6.1). The server can't read `ciphertext`; it checks the signature, the hash and that `prev`
 * links to the conversation's previous message before storing. A deleted message keeps `seq`,
 * `prev`, `hash` and `signature` so the chain still verifies; its content is erased.
 */
const messageSchema = new mongoose.Schema({
  conversation: { type: String, required: true },
  seq: { type: Number, required: true },
  envelope: { type: mongoose.Schema.Types.Mixed, required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receivedAt: { type: Date, default: Date.now },
});

messageSchema.index({ conversation: 1, seq: 1 }, { unique: true });
messageSchema.index({ sender: 1 });

messageSchema.set('toJSON', { transform: (doc, ret) => ret.envelope });

module.exports = mongoose.model('Message', messageSchema);
