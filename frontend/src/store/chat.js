import { createSlice } from '@reduxjs/toolkit';

export const userKey = (id) => `user:${id}`;
export const roomKey = (id) => `room:${id}`;

/** The conversation a message belongs to, from the point of view of user `meId`. */
export const conversationKey = (message, meId) => {
  if (message.room) return roomKey(message.room);
  return userKey(message.from.id === meId ? message.to : message.from.id);
};

const initialState = {
  contacts: {}, // key -> { key, id, name, kind: 'user' | 'room', online, unread }
  order: [], // contact keys, most recent activity first
  active: null,
  messages: {}, // key -> messages, oldest first
};

const touch = (state, key) => {
  state.order = [key, ...state.order.filter((k) => k !== key)];
};

const chat = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    contactAdded(state, { payload }) {
      const key = payload.kind === 'room' ? roomKey(payload.id) : userKey(payload.id);
      if (!state.contacts[key]) {
        state.contacts[key] = { key, online: false, unread: false, ...payload };
        state.order.push(key);
      }
    },
    presenceChanged(state, { payload: { userId, online } }) {
      const contact = state.contacts[userKey(userId)];
      if (contact) contact.online = online;
    },
    conversationOpened(state, { payload: key }) {
      state.active = key;
      if (state.contacts[key]) state.contacts[key].unread = false;
    },
    conversationClosed(state) {
      state.active = null;
    },
    historyLoaded(state, { payload: { key, messages } }) {
      state.messages[key] = messages;
    },
    messageReceived(state, { payload: { message, meId } }) {
      const key = conversationKey(message, meId);
      if (!state.contacts[key] && !message.room) {
        state.contacts[key] = {
          key, id: message.from.id, name: message.from.username, kind: 'user', online: true, unread: false,
        };
      }
      const list = state.messages[key] || [];
      if (list.some((m) => m.id === message.id)) return;
      state.messages[key] = [...list, message];
      if (state.active !== key && message.from.id !== meId && state.contacts[key]) {
        state.contacts[key].unread = true;
      }
      touch(state, key);
    },
    announcementReceived(state, { payload }) {
      const key = roomKey(payload.room);
      const list = state.messages[key] || [];
      state.messages[key] = [...list, { id: `announcement-${list.length}-${payload.createdAt}`, announcement: true, text: payload.text }];
    },
    chatReset: () => initialState,
  },
});

export const {
  contactAdded, presenceChanged, conversationOpened, conversationClosed, historyLoaded,
  messageReceived, announcementReceived, chatReset,
} = chat.actions;
export default chat.reducer;
