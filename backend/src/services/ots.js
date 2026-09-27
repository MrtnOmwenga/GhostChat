/*
 * The parts of the OpenTimestamps proof format GhostChat needs: parse and serialize a timestamp
 * tree, follow its operations to find where each attestation applies, and write a standard .ots
 * file that the official `ots verify` tool accepts. Only the operations calendars emit (append,
 * prepend, sha256) are supported; anything else is rejected rather than guessed.
 */
const crypto = require('crypto');

const TAG = { append: 0xf0, prepend: 0xf1, sha256: 0x08, attestation: 0x00, fork: 0xff };
const PENDING = Buffer.from('83dfe30d2ef90c8e', 'hex');
const BITCOIN = Buffer.from('0588960d73d71901', 'hex');
const FILE_MAGIC = Buffer.from('004f70656e54696d657374616d7073000050726f6f6600bf89e2e884e89294', 'hex');

class Reader {
  constructor(buf) { this.buf = buf; this.pos = 0; }

  byte() {
    if (this.pos >= this.buf.length) throw new Error('truncated timestamp');
    return this.buf[this.pos++];
  }

  bytes(n) {
    if (this.pos + n > this.buf.length) throw new Error('truncated timestamp');
    const out = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }

  varuint() {
    let value = 0;
    let shift = 0;
    for (;;) {
      const b = this.byte();
      value += (b & 0x7f) * 2 ** shift;
      if (!(b & 0x80)) return value;
      shift += 7;
    }
  }

  varbytes() { return this.bytes(this.varuint()); }
}

const varuint = (n) => {
  const out = [];
  let v = n;
  do {
    let b = v % 128;
    v = Math.floor(v / 128);
    if (v > 0) b |= 0x80;
    out.push(b);
  } while (v > 0);
  return Buffer.from(out);
};
const varbytes = (buf) => Buffer.concat([varuint(buf.length), buf]);

/** A node: { attestations: [{ tag, payload }], ops: [{ op, arg, child }] } for one message. */
function parseNode(reader) {
  const node = { attestations: [], ops: [] };
  const item = (tag) => {
    if (tag === TAG.attestation) {
      node.attestations.push({ tag: Buffer.from(reader.bytes(8)), payload: Buffer.from(reader.varbytes()) });
    } else if (tag === TAG.append || tag === TAG.prepend) {
      node.ops.push({ op: tag, arg: Buffer.from(reader.varbytes()), child: parseNode(reader) });
    } else if (tag === TAG.sha256) {
      node.ops.push({ op: tag, arg: null, child: parseNode(reader) });
    } else {
      throw new Error(`unsupported timestamp operation 0x${tag.toString(16)}`);
    }
  };
  let tag = reader.byte();
  while (tag === TAG.fork) {
    item(reader.byte());
    tag = reader.byte();
  }
  item(tag);
  return node;
}

const parse = (buf) => {
  const reader = new Reader(buf);
  const node = parseNode(reader);
  if (reader.pos !== buf.length) throw new Error('trailing bytes after timestamp');
  return node;
};

function serializeNode(node) {
  const items = [
    ...node.attestations.map((a) => Buffer.concat([Buffer.from([TAG.attestation]), a.tag, varbytes(a.payload)])),
    ...node.ops.map((o) => Buffer.concat([Buffer.from([o.op]), o.arg ? varbytes(o.arg) : Buffer.alloc(0), serializeNode(o.child)])),
  ];
  return Buffer.concat(items.map((item, i) => (i < items.length - 1 ? Buffer.concat([Buffer.from([TAG.fork]), item]) : item)));
}

const apply = (op, arg, msg) => {
  if (op === TAG.append) return Buffer.concat([msg, arg]);
  if (op === TAG.prepend) return Buffer.concat([arg, msg]);
  return crypto.createHash('sha256').update(msg).digest();
};

/** Every attestation in the tree with the message it attests to and the node holding it. */
function attestations(node, msg) {
  const found = node.attestations.map((a) => ({ ...a, msg, node }));
  node.ops.forEach((o) => found.push(...attestations(o.child, apply(o.op, o.arg, msg))));
  return found;
}

const pending = (node, digest) => attestations(node, digest)
  .filter((a) => a.tag.equals(PENDING))
  // The payload is itself length-prefixed: varbytes(uri).
  .map((a) => ({ uri: Buffer.from(new Reader(a.payload).varbytes()).toString('utf8'), commitment: a.msg, node: a.node }));

const bitcoin = (node, digest) => attestations(node, digest)
  .filter((a) => a.tag.equals(BITCOIN))
  .map((a) => ({ height: new Reader(a.payload).varuint(), merkleRoot: a.msg }));

/** Merges several calendars' timestamps for the same digest into one tree. */
const merge = (nodes) => ({
  attestations: nodes.flatMap((n) => n.attestations),
  ops: nodes.flatMap((n) => n.ops),
});

/** A detached .ots file for a SHA-256 digest (what `ots verify -d <digest>` expects). */
const otsFile = (digest, node) => Buffer.concat([FILE_MAGIC, varuint(1), Buffer.from([TAG.sha256]), digest, serializeNode(node)]);

module.exports = {
  parse, serialize: serializeNode, pending, bitcoin, merge, otsFile, varuint,
};
