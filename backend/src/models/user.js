const mongoose = require('mongoose');

// v3 accounts: the server holds a bcrypt hash of the password-derived authKey (never the password)
// and the vault, which it cannot open.
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  did: { type: String, required: true, unique: true },
  salt: { type: String, required: true },
  authHash: { type: String, required: true },
  vault: {
    nonce: { type: String, required: true },
    ciphertext: { type: String, required: true },
  },
  receiptsEnabled: { type: Boolean, default: false },
  // Which contacts the user has verified, encrypted in the browser with a key from the vault. The
  // server stores it so the marks follow the user to other devices, and can't read or forge it.
  pins: {
    nonce: { type: String },
    ciphertext: { type: String },
    version: { type: Number, default: 0 },
  },
}, { timestamps: true });

userSchema.set('toJSON', {
  transform: (doc, ret) => ({
    id: ret._id.toString(), username: ret.username, did: ret.did, receiptsEnabled: ret.receiptsEnabled,
  }),
});

module.exports = mongoose.model('User', userSchema);
