// Demo of tamper evidence (docs/DESIGN.md §9): edits one stored message the way a compromised
// server could, so you can watch the clients flag it. Local databases only.
//
//   npm run tamper -- <conversation> <seq> [content|link]
//     content  flips a byte of the ciphertext: the hash no longer matches (default)
//     link     rewrites the message's `prev`: the chain breaks at this message
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ghostchat';
const [conversation, seqArg, mode = 'content'] = process.argv.slice(2);

(async () => {
  const { hostname } = new URL(MONGODB_URI.replace(/^mongodb(\+srv)?:/, 'http:'));
  if (!['localhost', '127.0.0.1', 'mongo'].includes(hostname)) throw new Error(`Refusing to tamper with a non-local database (${hostname})`);
  if (!conversation || !seqArg || !['content', 'link'].includes(mode)) {
    throw new Error('usage: npm run tamper -- <conversation> <seq> [content|link]');
  }
  await mongoose.connect(MONGODB_URI);
  const messages = mongoose.connection.collection('messages');
  const message = await messages.findOne({ conversation, seq: Number(seqArg) });
  if (!message) throw new Error('No such message');

  const field = mode === 'content' ? 'envelope.ciphertext' : 'envelope.prev';
  const value = mode === 'content'
    ? `${message.envelope.ciphertext[0] === 'A' ? 'B' : 'A'}${message.envelope.ciphertext.slice(1)}`
    : 'f'.repeat(64);
  await messages.updateOne({ _id: message._id }, { $set: { [field]: value } });
  console.log(`Tampered with ${conversation} #${seqArg} (${mode}). Reload the conversation to see it flagged.`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
