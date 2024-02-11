import io from 'socket.io-client';
import store from './store.service';
import log from '../utils/logger.utils';
import GetTime from './time.service';

const uuid = require('uuid');

const ADD_MESSAGE = 'ADD_MESSAGE';
const RECEIVE_MESSAGE = 'RECEIVE_MESSAGE';
const ADD_CONTACT = 'ADD_CONTACT';
const UPDATE_CONTACT = 'UPDATE_CONTACT';

class SocketService {
  constructor() {
    this.socket = null;
  }

  initialize(user) {
    this.socket = io('http://localhost:8000');

    this.socket.on('connect', () => {
      log.info(`Connected with id ${this.socket.id}`);
      this.socket.emit('login', user.id, user.username);

      this.socket.emit('now-online', user.id, (MessageList) => {
        MessageList?.forEach((MessageObject) => {
          store.dispatch({
            type: ADD_CONTACT,
            payload: MessageObject.from,
          });
          store.dispatch({
            type: RECEIVE_MESSAGE,
            payload: MessageObject,
          });
        });
      });

      this.socket.on('receive-message', (message) => {
        store.dispatch({
          type: RECEIVE_MESSAGE,
          payload: message,
        });
        store.dispatch({
          type: ADD_CONTACT,
          payload: message.from,
        });
      });

      this.socket.on('changed-socket', (id, status, SocketID) => {
        store.dispatch({
          type: 'UPDATE_RECIPIENT_SOCKET',
          payload: {
            id,
            content: {
              status,
              socket_id: SocketID,
            },
          },
        });
        store.dispatch({
          type: UPDATE_CONTACT,
          payload: {
            id,
            content: {
              status,
              socket_id: SocketID,
            },
          },
        });
      });
    });
  }

  send_message(message, status, SocketId) {
    if (status === 'online' || status === 'group') {
      this.socket.emit('message', message, SocketId);
    } else {
      this.socket.emit('offline-queue', message);
    }

    store.dispatch({
      type: ADD_MESSAGE,
      payload: message,
    });
  }

  status(id) {
    return new Promise((resolve, reject) => {
      this.socket.emit('status', id, (status, SocketId) => {
        if (status !== undefined && SocketId !== undefined) {
          resolve({
            status,
            socket_id: SocketId,
            UnreadMessages: false,
          });
        } else {
          reject(new Error('Status and/or SocketId is undefined'));
        }
      });
    });
  }

  join_room(username, room, cb) {
    this.socket.emit('join-room', room.username, room.socket_id, (res) => {
      cb(`${res}`);
    });

    this.socket.emit('message', {
      id: uuid.v4(),
      message: `${username} has joined the room`,
      from: { ...room, status: 'announcement' },
      to: room.id,
      time: GetTime(),
    }, room.socket_id);
  }

  logout(id) {
    this.socket.emit('logout', id);
    this.socket.disconnect();
  }
}

const socket = new SocketService();
export default socket;
