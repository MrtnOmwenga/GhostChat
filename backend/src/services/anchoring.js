/*
 * Daily anchoring of the key transparency log to Bitcoin through OpenTimestamps calendars
 * (docs/DESIGN.md §5.3): independent, third-party evidence that a log root existed at a time, so
 * the log can't be rewritten after the fact without it showing. Calendars answer at once with a
 * pending proof; after a few hours they aggregate into a Bitcoin transaction, and upgrading
 * fetches the path to that block, which is checked against the block's Merkle root.
 */
const config = require('../config');
const Anchor = require('../models/anchor');
const log = require('./log');
const ots = require('./ots');

const TIMEOUT = 15_000;
const DAY = 24 * 60 * 60 * 1000;

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST', body, headers: { Accept: 'application/vnd.opentimestamps.v1', 'User-Agent': 'ghostchat' }, signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Timestamps the current log root with every reachable calendar. */
async function stamp() {
  const head = await log.head();
  if (head.size === 0) return null;
  const digest = Buffer.from(head.rootHash, 'hex');
  const results = await Promise.allSettled(config.otsCalendars.map((c) => post(`${c}/digest`, digest)));
  const trees = results.filter((r) => r.status === 'fulfilled').map((r) => ots.parse(r.value));
  if (trees.length === 0) throw new Error('no OpenTimestamps calendar reachable');
  return Anchor.create({ size: head.size, rootHash: head.rootHash, timestamp: ots.serialize(ots.merge(trees)).toString('hex') });
}

/** The Bitcoin block's Merkle root, in the byte order OpenTimestamps commits to. */
async function blockMerkleRoot(height) {
  const hash = await (await fetch(`${config.esploraUrl}/block-height/${height}`, { signal: AbortSignal.timeout(TIMEOUT) })).text();
  const block = await (await fetch(`${config.esploraUrl}/block/${hash.trim()}`, { signal: AbortSignal.timeout(TIMEOUT) })).json();
  return Buffer.from(block.merkle_root, 'hex').reverse();
}

/** Asks each calendar for the rest of the path to Bitcoin, then checks it against the block. */
async function upgrade(anchor) {
  const digest = Buffer.from(anchor.rootHash, 'hex');
  const tree = ots.parse(Buffer.from(anchor.timestamp, 'hex'));
  let changed = false;
  for (const p of ots.pending(tree, digest)) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(`${p.uri}/timestamp/${p.commitment.toString('hex')}`, {
        headers: { Accept: 'application/vnd.opentimestamps.v1' }, signal: AbortSignal.timeout(TIMEOUT),
      });
      if (res.ok) {
        // eslint-disable-next-line no-await-in-loop
        const upgraded = ots.parse(Buffer.from(await res.arrayBuffer()));
        p.node.attestations.push(...upgraded.attestations);
        p.node.ops.push(...upgraded.ops);
        changed = true;
      }
    } catch {
      // calendar unreachable or not ready; try again next round
    }
  }
  const [confirmation] = ots.bitcoin(tree, digest);
  if (confirmation) {
    const verified = (await blockMerkleRoot(confirmation.height)).equals(confirmation.merkleRoot);
    anchor.bitcoin = { height: confirmation.height, verified, checkedAt: new Date() };
  }
  if (changed || confirmation) {
    anchor.timestamp = ots.serialize(tree).toString('hex');
    await anchor.save();
  }
  return anchor;
}

/** One round: anchor if the log grew and the last anchor is a day old; upgrade pending anchors. */
async function tick() {
  const latest = await Anchor.findOne().sort({ createdAt: -1 });
  const head = await log.head();
  if (head.size > 0 && (!latest || (latest.size !== head.size && Date.now() - latest.createdAt > DAY))) await stamp();
  const pendingAnchors = await Anchor.find({ 'bitcoin.verified': { $ne: true }, createdAt: { $lt: new Date(Date.now() - 2 * 60 * 60 * 1000) } });
  for (const anchor of pendingAnchors) {
    // eslint-disable-next-line no-await-in-loop
    await upgrade(anchor).catch((err) => console.error('anchor upgrade failed:', err.message));
  }
}

function start() {
  if (!config.anchoring) return () => {};
  const run = () => tick().catch((err) => console.error('anchoring:', err.message));
  const first = setTimeout(run, 60_000);
  const timer = setInterval(run, 60 * 60 * 1000);
  return () => { clearTimeout(first); clearInterval(timer); };
}

const list = async () => (await Anchor.find().sort({ createdAt: -1 }).limit(30)).map((a) => a.toJSON());

async function otsFile(id) {
  const anchor = await Anchor.findById(id);
  return anchor && ots.otsFile(Buffer.from(anchor.rootHash, 'hex'), ots.parse(Buffer.from(anchor.timestamp, 'hex')));
}

module.exports = {
  stamp, upgrade, tick, start, list, otsFile,
};
