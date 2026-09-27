const Joi = require('joi');
const Message = require('../models/message');
const Room = require('../models/room');
const User = require('../models/user');
const KeyEntry = require('../models/keyEntry');
const { objectHash, sha256Hex, verifySignature } = require('../crypto');

const b64 = Joi.string().pattern(/^[A-Za-z0-9_-]+$/);
const objectId = Joi.string().hex().length(24);
const hex64 = Joi.string().pattern(/^[0-9a-f]{64}$/);

const envelopeSchema = Joi.object({
  v: Joi.valid(1).required(),
  conversation: Joi.string().pattern(/^(dm:[0-9a-f]{24}:[0-9a-f]{24}|room:[0-9a-f]{32})$/).required(),
  seq: Joi.number().integer().min(1).required(),
  prev: hex64.required(),
  sender: objectId.required(),
  senderKeyVersion: Joi.number().integer().min(1).required(),
  epoch: Joi.number().integer().min(1),
  nonce: b64.length(32).required(),
  ciphertext: b64.max(24000).required(),
  keys: Joi.object().pattern(objectId, Joi.object({ keyVersion: Joi.number().integer().min(1).required(), sealed: b64.length(107).required() })),
  logHead: Joi.object().unknown(true),
  createdAt: Joi.string().isoDate().required(),
  hash: hex64.required(),
  signature: b64.length(86).required(),
});

/** The `prev` of a conversation's first message: a fixed value bound to the conversation. */
const genesisHash = (conversation) => sha256Hex(`ghostchat/genesis/${conversation}`);

const dmConversation = (a, b) => `dm:${[a, b].sort().join(':')}`;

/** Who may read and post in a conversation; null if `userId` isn't one of them. */
async function access(conversation, userId) {
  if (conversation.startsWith('dm:')) {
    const [a, b] = conversation.slice(3).split(':');
    if (a >= b || (userId !== a && userId !== b)) return null;
    return { kind: 'dm', users: [a, b], other: userId === a ? b : a };
  }
  const room = await Room.findOne({ _id: conversation.slice(5), members: userId });
  return room ? { kind: 'room', room } : null;
}

const currentKeyEntry = async (userId) => (await KeyEntry.findOne({ user: userId }).sort({ version: -1 }))?.entry;

/**
 * Validates an envelope from `userId` and appends it to its conversation's chain.
 *
 * Returns { status: 'ok', envelope } when stored; 'conflict' (with the current head and the
 * messages the sender hasn't seen) when its `prev` is stale, so the client can rebase and resend
 * without the user noticing; 'rotation-needed' when the room key must be replaced first; or
 * 'error' with a reason.
 */
async function appendEnvelope(envelope, userId) {
  const { error, value: env } = envelopeSchema.validate(envelope, { convert: false });
  if (error) return { status: 'error', error: error.message };
  if (env.sender !== userId) return { status: 'error', error: 'sender must be the signed-in user' };
  if (Math.abs(Date.parse(env.createdAt) - Date.now()) > 10 * 60 * 1000) return { status: 'error', error: 'createdAt is too far from now' };

  const who = await access(env.conversation, userId);
  if (!who) return { status: 'error', error: 'not a participant in this conversation' };
  if (who.kind === 'dm') {
    if (env.epoch !== undefined) return { status: 'error', error: 'direct messages have no epoch' };
    const recipients = Object.keys(env.keys || {}).sort();
    if (recipients.join() !== who.users.join()) return { status: 'error', error: 'the content key must be sealed to both participants' };
    if (!(await User.exists({ _id: who.other }))) return { status: 'error', error: 'No such user' };
  } else {
    if (env.keys && Object.keys(env.keys).length) return { status: 'error', error: 'room messages use the room key' };
    if (who.room.rotationPending || env.epoch !== who.room.epoch) {
      return who.room.rotationPending
        ? { status: 'rotation-needed', epoch: who.room.epoch }
        : { status: 'error', error: `room key is at epoch ${who.room.epoch}` };
    }
  }

  const key = await currentKeyEntry(userId);
  if (!key || key.version !== env.senderKeyVersion) return { status: 'error', error: 'sign with your current key' };
  if (objectHash({ ...env, hash: undefined }) !== env.hash) return { status: 'error', error: 'hash does not match the envelope' };
  if (!verifySignature(key.signingKey, env.hash, env.signature)) return { status: 'error', error: 'invalid signature' };

  const head = await Message.findOne({ conversation: env.conversation }).sort({ seq: -1 });
  const headSeq = head ? head.seq : 0;
  const headHash = head ? head.envelope.hash : genesisHash(env.conversation);
  if (env.seq !== headSeq + 1 || env.prev !== headHash) return conflict(env);

  try {
    await Message.create({ conversation: env.conversation, seq: env.seq, envelope: env, sender: userId });
  } catch (err) {
    if (err.code === 11000) return conflict(env); // someone else took this seq a moment earlier
    throw err;
  }
  return { status: 'ok', envelope: env, access: who };
}

async function conflict(env) {
  const known = Math.max(0, Math.min(env.seq - 1, Number.MAX_SAFE_INTEGER));
  const missing = await Message.find({ conversation: env.conversation, seq: { $gt: known } }).sort({ seq: 1 }).limit(200);
  const head = await Message.findOne({ conversation: env.conversation }).sort({ seq: -1 });
  return {
    status: 'conflict',
    head: head ? { seq: head.seq, hash: head.envelope.hash } : { seq: 0, hash: genesisHash(env.conversation) },
    missing: missing.map((m) => m.envelope),
  };
}

/** Erases a message's content but keeps what the chain needs to stay verifiable. */
function tombstone(envelope, deletion) {
  const {
    ciphertext, nonce, keys, logHead, ...kept
  } = envelope;
  return { ...kept, deleted: deletion };
}

module.exports = {
  appendEnvelope, access, genesisHash, dmConversation, tombstone, envelopeSchema,
};
