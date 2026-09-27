import { io } from 'socket.io-client';
import store from '../app/store';
import { presenceChanged } from '../features/chat/chatSlice';

let socket = null;

/**
 * Opens the authenticated connection (the server identifies the user from the session cookie).
 * Handlers are passed in rather than imported, which keeps this module free of the messaging
 * logic that depends on it.
 */
export function connect({ onMessage, onRoom, onReceipt }) {
  if (socket) return socket;
  socket = io({ withCredentials: true });
  socket.on('message', (envelope) => onMessage(envelope));
  socket.on('room', (change) => onRoom(change));
  socket.on('receipt', (receipt) => onReceipt(receipt));
  socket.on('presence', (change) => store.dispatch(presenceChanged(change)));
  return socket;
}

export function disconnect() {
  socket?.disconnect();
  socket = null;
}

/** Emits and resolves with the server's acknowledgement. */
export function emitWithAck(event, payload, timeoutMs = 10_000) {
  if (!socket) return Promise.reject(new Error('Not connected'));
  return socket.timeout(timeoutMs).emitWithAck(event, payload).catch(() => ({ status: 'error', error: 'The server did not respond' }));
}

export function requestPresence(userIds) {
  if (!socket || userIds.length === 0) return;
  socket.emit('presence', userIds, (online) => {
    userIds.forEach((userId) => store.dispatch(presenceChanged({ userId, online: online.includes(userId) })));
  });
}
