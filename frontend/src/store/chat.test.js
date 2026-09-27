import { describe, expect, test } from 'vitest';
import reducer, {
  contactAdded, conversationOpened, messageReceived, presenceChanged, announcementReceived,
} from './chat';

const me = 'me';
const dm = (id, from, to, text = 'hi') => ({ id, from: { id: from, username: from }, to, text, createdAt: '2026-01-01T00:00:00Z' });

describe('chat state', () => {
  test('a message from a stranger creates the conversation and marks it unread', () => {
    const state = reducer(undefined, messageReceived({ message: dm('1', 'ada', me), meId: me }));
    expect(state.contacts['user:ada']).toMatchObject({ name: 'ada', unread: true });
    expect(state.messages['user:ada']).toHaveLength(1);
  });

  test('my own messages file under the recipient and are never unread', () => {
    let state = reducer(undefined, contactAdded({ id: 'ada', name: 'ada', kind: 'user' }));
    state = reducer(state, messageReceived({ message: dm('1', me, 'ada'), meId: me }));
    expect(state.messages['user:ada']).toHaveLength(1);
    expect(state.contacts['user:ada'].unread).toBe(false);
  });

  test('the same message delivered twice (two tabs, echo) is stored once', () => {
    let state = reducer(undefined, messageReceived({ message: dm('1', 'ada', me), meId: me }));
    state = reducer(state, messageReceived({ message: dm('1', 'ada', me), meId: me }));
    expect(state.messages['user:ada']).toHaveLength(1);
  });

  test('the open conversation does not get an unread marker', () => {
    let state = reducer(undefined, contactAdded({ id: 'ada', name: 'ada', kind: 'user' }));
    state = reducer(state, conversationOpened('user:ada'));
    state = reducer(state, messageReceived({ message: dm('1', 'ada', me), meId: me }));
    expect(state.contacts['user:ada'].unread).toBe(false);
  });

  test('room messages and announcements file under the room; presence updates users', () => {
    let state = reducer(undefined, contactAdded({ id: 'r1', name: 'Engine', kind: 'room' }));
    state = reducer(state, messageReceived({ message: { ...dm('1', 'ada', undefined), room: 'r1' }, meId: me }));
    state = reducer(state, announcementReceived({ room: 'r1', text: 'grace joined the room', createdAt: 't' }));
    expect(state.messages['room:r1'].map((m) => m.text)).toEqual(['hi', 'grace joined the room']);
    expect(state.contacts['user:ada']).toBeUndefined();

    state = reducer(state, contactAdded({ id: 'ada', name: 'ada', kind: 'user' }));
    state = reducer(state, presenceChanged({ userId: 'ada', online: true }));
    expect(state.contacts['user:ada'].online).toBe(true);
  });
});
