/*
 * Client side of the key transparency log (docs/DESIGN.md §5.3). The browser pins the log's key the
 * first time it sees it, keeps the latest head it verified, and checks every new head is consistent
 * with it: the log may grow but never be rewritten or forked.
 */
import api from './api';
import store from '../app/store';
import { logChecked } from '../features/chat/chatSlice';
import {
  sodium as loadSodium, verifyObject, inclusionPath, verifyConsistency, logLeafHash,
} from './crypto';

const hex = (sodium, h) => sodium.from_hex(h);
const PIN = 'ghostchat:log-key';
const LAST = 'ghostchat:log-head';
const read = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* unavailable */ } };

let logKey = null;
let latest = null; // latest verified head
const checkedHeads = new Map(); // head signature -> problem or null

async function publicKey() {
  if (logKey) return logKey;
  const { data } = await api.get('/log/key');
  const pinned = read(PIN);
  if (pinned && pinned !== data.publicKey) {
    report(['the log signing key changed since this browser first saw it']);
  } else if (!pinned) {
    write(PIN, data.publicKey);
  }
  logKey = pinned || data.publicKey;
  return logKey;
}

function report(problems, head = latest) {
  store.dispatch(logChecked({ ok: problems.length === 0, problems, head, at: new Date().toISOString() }));
}

/** Verifies a head's signature and that it's consistent with the last head this browser saw. */
export async function acceptHead(head) {
  const sodium = await loadSodium();
  if (!verifyObject(sodium, head, await publicKey())) {
    report(['a log head is not signed by the log key']);
    return false;
  }
  const previous = latest || read(LAST);
  if (previous && head.size < previous.size) {
    report([`the log shrank from ${previous.size} to ${head.size} entries`]);
    return false;
  }
  if (previous && !(previous.size === head.size && previous.rootHash === head.rootHash)) {
    const { data } = await api.get('/log/consistency', { params: { from: previous.size, to: head.size } });
    const ok = verifyConsistency(sodium, previous.size, head.size, data.proof.map((h) => hex(sodium, h)), hex(sodium, previous.rootHash), hex(sodium, head.rootHash));
    if (!ok) {
      report([`the log is not consistent with what this browser saw at ${previous.size} entries: it was rewritten`]);
      return false;
    }
  }
  if (!latest || head.size >= latest.size) {
    latest = head;
    write(LAST, { size: head.size, rootHash: head.rootHash });
  }
  report([]);
  return true;
}

/**
 * Checks that every entry of a user's key history is in the log. Returns problems (empty if all
 * are included) and the proof paths, for display.
 */
export async function checkUserInLog(userId, entries) {
  const sodium = await loadSodium();
  const { data } = await api.get(`/log/users/${userId}`);
  const problems = [];
  if (!(await acceptHead(data.head))) problems.push('the transparency log did not verify');
  const byVersion = new Map(data.leaves.map((l) => [l.version, l]));
  const paths = entries.map((entry) => {
    const leaf = byVersion.get(entry.version);
    if (!leaf) {
      problems.push(`key version ${entry.version} is not in the transparency log`);
      return null;
    }
    const expected = logLeafHash(sodium, entry.username, entry);
    if (sodium.to_hex(expected) !== leaf.leafHash) problems.push(`key version ${entry.version} differs from the logged one`);
    const path = inclusionPath(sodium, expected, leaf.index, data.head.size, leaf.proof.map((h) => hex(sodium, h)), hex(sodium, data.head.rootHash));
    if (!path.ok) problems.push(`key version ${entry.version} has no valid inclusion proof`);
    return { version: entry.version, index: leaf.index, leafHash: leaf.leafHash, path };
  });
  return { problems, paths, head: data.head };
}

/** The head I attach to my envelopes, so recipients can tell if we're shown different logs. */
export const currentHead = () => latest;

/**
 * A head seen in someone else's envelope. Different heads are fine if one extends the other;
 * two heads that can't both be true mean the server is showing people different logs.
 */
export async function checkPeerHead(head) {
  if (!head?.signature) return null;
  if (checkedHeads.has(head.signature)) return checkedHeads.get(head.signature);
  const sodium = await loadSodium();
  let problem = null;
  if (!verifyObject(sodium, head, await publicKey())) problem = "the sender's log head is not signed by the log key";
  else if (latest) {
    const [small, large] = head.size <= latest.size ? [head, latest] : [latest, head];
    if (small.size === large.size) {
      if (small.rootHash !== large.rootHash) problem = 'the sender is being shown a different key log (split view)';
    } else {
      const { data } = await api.get('/log/consistency', { params: { from: small.size, to: large.size } });
      const ok = verifyConsistency(sodium, small.size, large.size, data.proof.map((h) => hex(sodium, h)), hex(sodium, small.rootHash), hex(sodium, large.rootHash));
      if (!ok) problem = 'the sender is being shown a different key log (split view)';
    }
  }
  checkedHeads.set(head.signature, problem);
  return problem;
}
