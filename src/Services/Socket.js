import io from 'socket.io-client';
import log from '../Utils/logger';

const Socket = (id, username) => {
  const socket = io('http://localhost:8000');
  socket.on('connect', () => {
    log.info(`Connected with is ${socket.id}`);
  });

  socket.emit('login', id, username);

  return socket;
};

export default Socket;
