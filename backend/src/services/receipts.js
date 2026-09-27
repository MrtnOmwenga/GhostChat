const Joi = require('joi');
const Receipt = require('../models/receipt');
const Message = require('../models/message');
const User = require('../models/user');
const KeyEntry = require('../models/keyEntry');
const { objectHash, verifySignature } = require('../crypto');
const { access } = require('./chain');

const receiptSchema = Joi.object({
  type: Joi.valid('read').required(),
  reader: Joi.string().hex().length(24).required(),
  conversation: Joi.string().pattern(/^(dm:[0-9a-f]{24}:[0-9a-f]{24}|room:[0-9a-f]{32})$/).required(),
  upToSeq: Joi.number().integer().min(1).required(),
  upToHash: Joi.string().pattern(/^[0-9a-f]{64}$/).required(),
  at: Joi.string().isoDate().required(),
  keyVersion: Joi.number().integer().min(1).required(),
  signature: Joi.string().pattern(/^[A-Za-z0-9_-]{86}$/).required(),
});

/** Participants of a conversation who have read receipts turned on (receipts are reciprocal). */
async function receiptParticipants(who) {
  const ids = who.kind === 'dm' ? who.users : who.room.members.map(String);
  return (await User.find({ _id: { $in: ids }, receiptsEnabled: true }, { _id: 1 })).map((u) => u.id);
}

/**
 * Stores a signed receipt if the reader has receipts on and it points at a real message. Returns
 * { status, receipt, audience } where audience is who may see it.
 */
async function recordReceipt(receipt, userId) {
  const { error, value } = receiptSchema.validate(receipt, { convert: false });
  if (error) return { status: 'error', error: error.message };
  if (value.reader !== userId) return { status: 'error', error: 'you can only send your own receipts' };
  const who = await access(value.conversation, userId);
  if (!who) return { status: 'error', error: 'not a participant in this conversation' };
  const audience = await receiptParticipants(who);
  if (!audience.includes(userId)) return { status: 'error', error: 'read receipts are off' };
  const message = await Message.findOne({ conversation: value.conversation, seq: value.upToSeq });
  if (!message || message.envelope.hash !== value.upToHash) return { status: 'error', error: 'no such message' };
  const key = await KeyEntry.findOne({ user: userId }).sort({ version: -1 });
  if (key?.version !== value.keyVersion || !verifySignature(key.entry.signingKey, objectHash(value), value.signature)) {
    return { status: 'error', error: 'invalid receipt signature' };
  }
  const stored = await Receipt.findOneAndUpdate(
    { conversation: value.conversation, reader: userId, upToSeq: { $lt: value.upToSeq } },
    { $set: { upToSeq: value.upToSeq, receipt: value } },
    { upsert: true, returnDocument: 'after' },
  ).catch((err) => (err.code === 11000 ? null : Promise.reject(err))); // an older receipt than stored
  return { status: 'ok', receipt: stored ? value : null, audience, access: who };
}

/** Receipts a user may see in a conversation: none unless they have receipts on themselves. */
async function visibleReceipts(conversation, userId) {
  const who = await access(conversation, userId);
  if (!who) return null;
  const audience = await receiptParticipants(who);
  if (!audience.includes(userId)) return [];
  return Receipt.find({ conversation, reader: { $in: audience } });
}

module.exports = { recordReceipt, visibleReceipts };
