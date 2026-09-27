const crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('../config');
const Message = require('../models/message');

/*
 * Encrypted attachments (docs/DESIGN.md §8), stored in MongoDB's GridFS so they need no storage
 * service of their own. The browser encrypts every file before upload; the server stores bytes it
 * can't read, under the SHA-256 of those bytes. A file belongs to one conversation and one
 * uploader, and lives as long as a message still refers to it.
 */

const ORPHAN_AFTER_MS = 60 * 60 * 1000;

const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'files' });
const fileDocs = () => mongoose.connection.db.collection('files.files');

const find = (id) => fileDocs().findOne({ _id: id });

async function usedBytes(owner) {
  const [total] = await fileDocs().aggregate([
    { $match: { 'metadata.owner': owner } },
    { $group: { _id: null, bytes: { $sum: '$length' } } },
  ]).toArray();
  return total ? total.bytes : 0;
}

/**
 * Stores an uploaded (already encrypted) file. Returns { id, size }, or { error, status }.
 * Uploading the same bytes again is a no-op, which lets a client retry safely.
 */
async function store(bytes, { owner, conversation }) {
  const id = crypto.createHash('sha256').update(bytes).digest('hex');
  const existing = await find(id);
  if (existing) {
    const same = existing.metadata.owner === owner && existing.metadata.conversation === conversation;
    return same ? { id, size: existing.length } : { status: 409, error: 'This file was already uploaded elsewhere' };
  }
  if ((await usedBytes(owner)) + bytes.length > config.files.quotaBytes) {
    return { status: 413, error: 'Your storage quota is full; delete some files first' };
  }
  await new Promise((resolve, reject) => {
    const upload = bucket().openUploadStreamWithId(id, id, { metadata: { owner, conversation } });
    upload.once('finish', resolve).once('error', reject);
    upload.end(bytes);
  });
  return { id, size: bytes.length };
}

/**
 * Checks an envelope's attachment list before the message is stored: each file must have been
 * uploaded by the sender, into this conversation, with the stated size.
 */
async function checkAttachments(env, userId) {
  for (const { id, size } of env.attachments || []) {
    // eslint-disable-next-line no-await-in-loop
    const file = await find(id);
    if (!file || file.metadata.owner !== userId || file.metadata.conversation !== env.conversation) return `unknown attachment ${id}`;
    if (file.length !== size) return `attachment ${id} has a different size`;
  }
  return null;
}

const openDownload = (id) => bucket().openDownloadStream(id);

async function remove(id) {
  await bucket().delete(id).catch((err) => {
    if (!/not found/i.test(err.message)) throw err;
  });
}

/** Deletes the files of a deleted message, unless another live message still refers to them. */
async function release(envelope) {
  for (const { id } of envelope.attachments || []) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await Message.exists({ 'envelope.attachments.id': id, 'envelope.deleted': { $exists: false } }))) await remove(id);
  }
}

async function removeOwnedBy(owner) {
  const ids = await fileDocs().find({ 'metadata.owner': owner }, { projection: { _id: 1 } }).toArray();
  for (const { _id } of ids) await remove(_id); // eslint-disable-line no-await-in-loop
}

/** Uploads that no message ever referred to (a closed tab, a failed send) are removed after an hour. */
async function sweep(now = Date.now()) {
  const stale = await fileDocs().find({ uploadDate: { $lt: new Date(now - ORPHAN_AFTER_MS) } }, { projection: { _id: 1 } }).toArray();
  let removed = 0;
  for (const { _id } of stale) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await Message.exists({ 'envelope.attachments.id': _id }))) {
      await remove(_id); // eslint-disable-line no-await-in-loop
      removed += 1;
    }
  }
  return removed;
}

function start() {
  const timer = setInterval(() => sweep().catch((err) => console.error('file sweep:', err.message)), 10 * 60 * 1000);
  return () => clearInterval(timer);
}

module.exports = {
  store, find, checkAttachments, openDownload, release, removeOwnedBy, sweep, start,
};
