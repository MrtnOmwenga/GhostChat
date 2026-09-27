import { describe, expect, test } from 'vitest';
import reducer, {
  contactUpserted, conversationOpened, recordsReceived, presenceChanged, pendingAdded, pendingRemoved,
} from './chatSlice';

const me = 'me';
const record = (seq, sender, text = `m${seq}`) => ({ seq, hash: `h${seq}`, sender, kind: 'text', text, createdAt: `2026-01-01T00:0${seq}:00Z` });
const withContact = () => reducer(undefined, contactUpserted({ conversation: 'dm:a:b', kind: 'user', id: 'ada', name: 'ada' }));

describe('chat state', () => {
  test('records merge in chain order, and a later copy of a seq replaces the earlier one', () => {
    let state = withContact();
    state = reducer(state, recordsReceived({ conversation: 'dm:a:b', records: [record(2, 'ada'), record(1, me)], meId: me }));
    state = reducer(state, recordsReceived({ conversation: 'dm:a:b', records: [{ ...record(1, me), kind: 'deleted' }], meId: me }));
    expect(state.messages['dm:a:b'].map((r) => [r.seq, r.kind])).toEqual([[1, 'deleted'], [2, 'text']]);
    expect(state.contacts['dm:a:b'].preview).toBe('m2');
  });

  test('live messages from others mark a closed conversation unread, never the open one', () => {
    let state = withContact();
    state = reducer(state, recordsReceived({ conversation: 'dm:a:b', records: [record(1, 'ada')], meId: me, live: true }));
    expect(state.contacts['dm:a:b'].unread).toBe(true);
    state = reducer(state, conversationOpened('dm:a:b'));
    state = reducer(state, recordsReceived({ conversation: 'dm:a:b', records: [record(2, 'ada')], meId: me, live: true }));
    expect(state.contacts['dm:a:b'].unread).toBe(false);
  });

  test('history loads never mark anything unread; my own messages never do', () => {
    let state = withContact();
    state = reducer(state, recordsReceived({ conversation: 'dm:a:b', records: [record(1, 'ada')], meId: me }));
    state = reducer(state, recordsReceived({ conversation: 'dm:a:b', records: [record(2, me)], meId: me, live: true }));
    expect(state.contacts['dm:a:b'].unread).toBe(false);
  });

  test('presence updates the matching user contact; pending sends come and go', () => {
    let state = reducer(withContact(), presenceChanged({ userId: 'ada', online: true }));
    expect(state.contacts['dm:a:b'].online).toBe(true);
    state = reducer(state, pendingAdded({ conversation: 'dm:a:b', tempId: 't1', text: 'hi' }));
    expect(state.pending['dm:a:b']).toHaveLength(1);
    state = reducer(state, pendingRemoved({ conversation: 'dm:a:b', tempId: 't1' }));
    expect(state.pending['dm:a:b']).toHaveLength(0);
  });
});
