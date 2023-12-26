import io from 'socket.io-client';
import log from '../Utils/logger';

/**
 * The function creates a socket connection to a server and emits a 'login' event with an id and
 * username.
 * @param id - The `id` parameter is the unique identifier for the user's socket connection.
 * It can be any value that uniquely identifies the user, such as a user ID or a session ID.
 * @param username - The `username` parameter is a string that represents the username of
 * the user who is connecting to the socket.
 * @returns The function `Socket` returns a socket object that is connected to a server at
 * `http://localhost:8000`.
 */
const Socket = (id, username) => {
  const socket = io('http://localhost:8000');
  socket.on('connect', () => {
    log.info(`Connected with id ${socket.id}`);
  });

  socket.emit('login', id, username);

  return socket;
};

export default Socket;
