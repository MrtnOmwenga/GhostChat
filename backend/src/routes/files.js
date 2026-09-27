const express = require('express');
const Joi = require('joi');
const config = require('../config');
const files = require('../services/files');
const { access } = require('../services/chain');
const { validate, HttpError } = require('../errors');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

const conversation = Joi.string().pattern(/^(dm:[0-9a-f]{24}:[0-9a-f]{24}|room:[0-9a-f]{32})$/).required();
const fileId = Joi.string().pattern(/^[0-9a-f]{64}$/).required();

// Encryption adds a header and 17 bytes per 64 KiB chunk; the slack covers that.
const readBody = (req, res) => new Promise((resolve, reject) => {
  express.raw({ type: 'application/octet-stream', limit: config.files.maxBytes + 64 * 1024 })(req, res, (err) => {
    if (err?.type === 'entity.too.large') reject(new HttpError(413, `Files can be up to ${config.files.maxBytes / (1024 * 1024)} MB`));
    else if (err) reject(err);
    else resolve(req.body);
  });
});

// The body is a file the browser has already encrypted. The server can't check its type or
// content, only its size and who may upload into the conversation.
router.post('/', async (req, res) => {
  const { conversation: target } = validate(Joi.object({ conversation }), req.query);
  if (!(await access(target, req.user.id))) throw new HttpError(403, 'Not a participant in this conversation');
  const bytes = await readBody(req, res);
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw new HttpError(400, 'Send the encrypted file as application/octet-stream');
  const result = await files.store(bytes, { owner: req.user.id, conversation: target });
  if (result.error) throw new HttpError(result.status, result.error);
  res.status(201).json(result);
});

// Only participants of the file's conversation get it. Content never changes for an ID (it is the
// hash of the content), so browsers may cache it for good.
router.get('/:id', async (req, res) => {
  const id = validate(fileId, req.params.id);
  const file = await files.find(id);
  if (!file || !(await access(file.metadata.conversation, req.user.id))) throw new HttpError(404, 'No such file');
  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Length': String(file.length),
    'Cache-Control': 'private, max-age=31536000, immutable',
  });
  files.openDownload(id).on('error', (err) => res.destroy(err)).pipe(res);
});

module.exports = router;
