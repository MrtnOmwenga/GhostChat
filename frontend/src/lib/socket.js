import { io } from 'socket.io-client';
import store from '../app/store';
import { announcementReceived, messageReceived, presenceChanged } from '../features/chat/chatSlice';

let socket = null;

/** Opens the authenticated connection; the server identifies the user from the session cookie. */
export function connect() {
  if (socket) return socket;
  socket = io({ withCredentials: true });
  socket.on('message', (message) => {
    store.dispatch(messageReceived({ message, meId: store.getState().session.user?.id }));
  });
  socket.on('announcement', (announcement) => store.dispatch(announcementReceived(announcement)));
  socket.on('presence', (change) => store.dispatch(presenceChanged(change)));
  return socket;
}

export function disconnect() {
  socket?.disconnect();
  socket = null;
}

/** Resolves with the server's reply, or rejects with its error message. */
export function sendMessage(target, text) {
  return new Promise((resolve, reject) => {
    socket.emit('message', { ...target, text }, (reply) => {
      if (reply?.error) reject(new Error(reply.error));
      else resolve(reply.message);
    });
  });
}

export function requestPresence(userIds) {
  if (!socket || userIds.length === 0) return;
  socket.emit('presence', userIds, (online) => {
    userIds.forEach((userId) => store.dispatch(presenceChanged({ userId, online: online.includes(userId) })));
  });
}
