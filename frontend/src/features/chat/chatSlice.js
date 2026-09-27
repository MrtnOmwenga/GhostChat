import { createSlice } from '@reduxjs/toolkit';

/*
 * Conversations are keyed by their chain id: `dm:<userA>:<userB>` or `room:<roomId>`.
 * `messages[conversation]` holds decrypted, verified records in chain order:
 *   { hash, seq, prev, sender, senderName, createdAt, kind: 'text' | 'event' | 'deleted' | 'unreadable',
 *     text, event, verification: { signature, link, problems } }
 * Crypto objects (keys) never enter the store; they live in lib/messaging.
 */
const initialState = {
  contacts: {}, // conversation -> { conversation, kind: 'user'|'room', id, name, online, unread, preview, previewAt, fingerprint, epoch, members }
  order: [], // conversations, most recent activity first
  active: null,
  messages: {},
  pending: {}, // conversation -> [{ tempId, text }]
  receipts: {}, // conversation -> readerId -> { upToSeq, at, verified }
  keyChanges: {}, // userId -> latest key version announced; key views re-read histories when it moves
  log: null, // latest transparency-log check: { ok, problems, head, at }
};

const touch = (state, conversation) => {
  state.order = [conversation, ...state.order.filter((c) => c !== conversation)];
};

const chat = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    contactUpserted(state, { payload }) {
      const existing = state.contacts[payload.conversation];
      state.contacts[payload.conversation] = { online: false, unread: false, ...existing, ...payload };
      if (!existing) state.order.push(payload.conversation);
    },
    contactRemoved(state, { payload: conversation }) {
      delete state.contacts[conversation];
      delete state.messages[conversation];
      state.order = state.order.filter((c) => c !== conversation);
      if (state.active === conversation) state.active = null;
    },
    presenceChanged(state, { payload: { userId, online } }) {
      Object.values(state.contacts).forEach((c) => {
        if (c.kind === 'user' && c.id === userId) c.online = online;
      });
    },
    conversationOpened(state, { payload: conversation }) {
      state.active = conversation;
      if (state.contacts[conversation]) state.contacts[conversation].unread = false;
    },
    conversationClosed(state) {
      state.active = null;
    },
    /** Merges records by seq, keeping chain order; a later copy of a seq (e.g. a tombstone) wins. */
    recordsReceived(state, { payload: { conversation, records, meId, live } }) {
      const bySeq = new Map((state.messages[conversation] || []).map((r) => [r.seq, r]));
      records.forEach((r) => bySeq.set(r.seq, r));
      state.messages[conversation] = [...bySeq.values()].sort((a, b) => a.seq - b.seq);
      const last = state.messages[conversation][state.messages[conversation].length - 1];
      const contact = state.contacts[conversation];
      if (contact && last) {
        contact.preview = last.kind === 'text' ? last.text : (last.previewText || '');
        contact.previewAt = last.createdAt;
      }
      if (live && contact && state.active !== conversation && records.some((r) => r.sender !== meId && r.kind !== 'event')) {
        contact.unread = true;
      }
      if (live) touch(state, conversation);
    },
    pendingAdded(state, { payload: { conversation, tempId, text, file } }) {
      state.pending[conversation] = [...(state.pending[conversation] || []), { tempId, text, ...(file ? { file } : {}) }];
    },
    pendingRemoved(state, { payload: { conversation, tempId } }) {
      state.pending[conversation] = (state.pending[conversation] || []).filter((p) => p.tempId !== tempId);
    },
    receiptReceived(state, { payload: { conversation, reader, upToSeq, at, verified } }) {
      const byReader = state.receipts[conversation] || {};
      if (!byReader[reader] || byReader[reader].upToSeq < upToSeq) {
        state.receipts[conversation] = { ...byReader, [reader]: { upToSeq, at, verified } };
      }
    },
    keysChanged(state, { payload: { user, version } }) {
      state.keyChanges[user] = version;
    },
    logChecked(state, { payload }) {
      // A failure sticks until the page reloads: a later clean check doesn't undo evidence of tampering.
      if (state.log && !state.log.ok && payload.ok) return;
      state.log = payload;
    },
    chatReset: () => initialState,
  },
});

export const {
  contactUpserted, contactRemoved, presenceChanged, conversationOpened, conversationClosed,
  recordsReceived, pendingAdded, pendingRemoved, receiptReceived, keysChanged, logChecked, chatReset,
} = chat.actions;
export default chat.reducer;
