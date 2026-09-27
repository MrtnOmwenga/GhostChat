const express = require('express');
const Joi = require('joi');
const { validate, HttpError } = require('../errors');
const { requireAuth } = require('../auth');
const log = require('../services/log');
const anchoring = require('../services/anchoring');

const router = express.Router();

// Public: anyone can audit the log without an account.
router.get('/key', (req, res) => res.json({ publicKey: log.publicKey }));
router.get('/head', async (req, res) => res.json(await log.head()));

router.get('/head/:size', async (req, res) => {
  const head = await log.head(validate(Joi.number().integer().min(0).required(), req.params.size));
  if (!head) throw new HttpError(404, 'The log has not reached that size');
  res.json(head);
});

router.get('/consistency', async (req, res) => {
  const { from, to } = validate(Joi.object({ from: Joi.number().integer().min(0).required(), to: Joi.number().integer().min(0).required() }), req.query);
  const proof = await log.consistency(from, to);
  if (!proof) throw new HttpError(400, 'Invalid range');
  res.json({ from, to, proof });
});

router.get('/entries', async (req, res) => res.json(await log.recent()));

router.get('/anchors', async (req, res) => res.json(await anchoring.list()));

router.get('/anchors/:id.ots', async (req, res) => {
  const file = await anchoring.otsFile(validate(Joi.string().hex().length(24).required(), req.params.id));
  if (!file) throw new HttpError(404, 'No such anchor');
  res.set('Content-Disposition', `attachment; filename="ghostchat-log-${req.params.id}.ots"`).type('application/octet-stream').send(file);
});

router.get('/users/:id', requireAuth, async (req, res) => {
  res.json(await log.userProofs(validate(Joi.string().hex().length(24).required(), req.params.id)));
});

module.exports = router;
