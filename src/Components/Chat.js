import React, { useState } from 'react';
import { FaPaperPlane } from 'react-icons/fa6';
import style from '../Assets/Style/Chat.module.css';
import log from '../Utils/logger';

const Chat = ({ socket, CurrentUser }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  socket?.on('receive-message', (message) => {
    setMessages(messages.concat({ message, fromMe: false }));
    log.info('Received');
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    setMessages(messages.concat({ message: text, fromMe: true }));
    socket.emit('message', text, CurrentUser.socket_id);
    setText('');
  };

  const handleChange = (event) => {
    setText(event.target.value);
  };

  const DisplayMessages = () => {
    const chats = messages.map((message) => {
      log.info(message);
      if (message.fromMe) {
        return <p className={`${style.message} ${style.from_me}`}>{message.message}</p>;
      }
      return <p className={`${style.message} ${style.not_from_me}`}>{message.message}</p>;
    });

    return chats;
  };

  return (
    <div className={style.chat}>
      <div>
        {DisplayMessages()}
      </div>
      <form onSubmit={handleSubmit}>
        <input type="text" value={text} placeholder="Type a message" onChange={handleChange} />
        <button type="submit">
          <FaPaperPlane className={style.send_icon} size={25} />
        </button>
      </form>
    </div>
  );
};

export default Chat;
