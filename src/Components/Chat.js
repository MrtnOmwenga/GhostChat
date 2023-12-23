import React, { useState, useEffect } from 'react';
import style from '../Assets/Style/Chat.module.css';
import log from '../Utils/logger';

const uuid = require('uuid');

// Get and return current time
const GetTime = () => {
  const date = new Date();
  const hour = date.getHours();
  let minute = date.getMinutes();

  if (minute <= 9) {
    minute = `0${minute}`;
  }

  return { hour, minute };
};

// Remove any duplicated messages in state
const RemoveDuplicates = (List) => {
  const ids = List.map((object) => object.id);
  const filtered = List.filter((object, index) => !ids.includes(object.id, index + 1));

  return filtered;
};

const Chat = ({ socket, Recipient, User }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  useEffect(() => {
    // Get all messages that were sent ehile user was away
    socket?.emit('now-online', User.id, (MessageList) => {
      const List = MessageList?.map((MessageObject) => {
        const NewObject = {
          ...MessageObject, fromMe: false,
        };
        return NewObject;
      });

      // Remove dumplicates then add to state
      if (List) {
        setMessages(RemoveDuplicates(messages.concat(List)));
      }
    });
  }, [socket]);

  // Recieve messages function
  socket?.on('receive-message', (message) => {
    // Add messages to state
    setMessages(messages.concat({ ...message, fromMe: false }));
    log.info(message);
  });

  // Send messages function
  const handleSubmit = (event) => {
    event.preventDefault();
    const time = GetTime();

    // Create message object
    const MessageObject = {
      id: uuid.v4(),
      message: text,
      from: Recipient.status === 'group' ? { ...Recipient, sender: User.username } : { ...User, socket_id: socket.id, status: 'online' },
      to: Recipient.id,
      time,
    };

    // Add message to display list
    setMessages(messages.concat({ ...MessageObject, fromMe: true }));

    // Send message
    if (Recipient.status === 'online' || Recipient.status === 'group') {
      socket.emit('message', MessageObject, Recipient.socket_id);
    } else {
      socket.emit('offline-queue', MessageObject);
    }

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
    let ChatsToDisplay = messages.map((ChatObject) => {
      if (ChatObject.from.id === Recipient.id || ChatObject.to === Recipient.id) {
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
    if (Recipient === null) {
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
