const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
}, { timestamps: true });

userSchema.set('toJSON', {
  transform: (doc, ret) => ({ id: ret._id.toString(), username: ret.username }),
});

module.exports = mongoose.model('User', userSchema);
