import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import socket from '../services/socket.service';
import style from '../assets/style/chat.module.css';
import GetTime from '../services/time.service';
// import log from '../utils/logger.utils';

const uuid = require('uuid');

const Chat = ({ user }) => {
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([]);

  const recipient = useSelector((state) => state.recipient);
  const MessageList = useSelector((state) => state.messages);
  useEffect(() => {
    setMessages(MessageList);
  }, [MessageList]);

  // Send messages function
  const handleSubmit = (event) => {
    event.preventDefault();

    // Add message to display list
    socket.send_message({
      id: uuid.v4(),
      message: text,
      from: recipient.status === 'group' ? { ...recipient, sender: user.username } : { ...user, socket_id: socket.id, status: 'online' },
      to: recipient.id,
      time: GetTime(),
    }, recipient.status, recipient.socket_id);

    // Clear state
    setText('');
  };

  // Save message input to state
  const handleChange = (event) => {
    setText(event.target.value);
  };

  // Display user messages (Both received and sent)
  const DisplayMessages = () => {
    // Check messages are from or to intended user (stored in Recipient object)
    let ChatsToDisplay = messages?.map((ChatObject) => {
      if (ChatObject.from.id === recipient.id || ChatObject.to === recipient.id) {
        return ChatObject;
      }
      return null;
    });

    // Remove null objects
    ChatsToDisplay = ChatsToDisplay.filter((object) => object !== null);

    // Return display objects
    const chats = ChatsToDisplay?.map((message) => {
      if (message && message.fromMe) {
        return (
          <div className={style.message_container}>
            <p className={`${style.message} ${style.from_me}`}>
              {message.message}
              <br />
              <span>{`${message.time.hour}:${message.time.minute}`}</span>
            </p>
          </div>
        );
      }
      if (message.from.status !== 'announcement') {
        return (
          <div className={style.message_container}>
            <p className={`${style.message} ${style.not_from_me}`}>
              {message.from.status === 'group' && (
              <span>
                {message.from.sender}
                <br />
              </span>
              )}
              {message.message}
              <br />
              <span>{`${message.time.hour}:${message.time.minute}`}</span>
            </p>
          </div>
        );
      }

      return (
        <div className={style.message_container}>
          <p className={`${style.announcement}`}>
            {message.message}
          </p>
        </div>
      );
    });

    return chats;
  };

  // Content to be displayed on the screen
  const display = () => {
    if (recipient === null) {
      return <p className={style.select_text}>Search and select a user to start messaging</p>;
    }
    return (
      <div className={style.chat}>
        <div className={style.ChatContainer}>
          {DisplayMessages()}
        </div>
        <form onSubmit={handleSubmit}>
          <input type="text" value={text} placeholder="Type a message" onChange={handleChange} />
          <button type="submit">
            {' '}
          </button>
        </form>
      </div>
    );
  };

  return (
    display()
  );
};

export default Chat;
