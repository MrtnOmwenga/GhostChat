import React, { useState, useEffect } from 'react';
import { FaPaperPlane } from 'react-icons/fa6';
import style from '../Assets/Style/Chat.module.css';
// import log from '../Utils/logger';

const GetTime = () => {
  const date = new Date();
  const hour = date.getHours();
  let minute = date.getMinutes();

  if (minute <= 9) {
    minute = `0${minute}`;
  }

  return { hour, minute };
};

const RemoveDuplicates = (List) => {
  const ids = List.map((object) => object.message);
  const filtered = List.filter((object, index) => !ids.includes(object.message, index + 1));

  return filtered;
};

const Chat = ({ socket, Recipient, User }) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  useEffect(() => {
    socket?.emit('now-online', User.id, (MessageList) => {
      const List = MessageList?.map((MessageObject) => {
        const NewObject = {
          message: MessageObject.message,
          fromMe: false,
          from: MessageObject.from,
          time: MessageObject.time,
        };
        return NewObject;
      });
      if (List) {
        setMessages(RemoveDuplicates(messages.concat(List)));
      }
    });
  }, [socket]);

  socket?.on('receive-message', (message) => {
    const time = GetTime();
    const NewMessage = {
      message: message.message,
      from: message.from,
      fromMe: false,
      time,
    };
    setMessages(messages.concat(NewMessage));
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    const time = GetTime();
    setMessages(messages.concat({
      message: text,
      fromMe: true,
      from: { ...User, socket_id: socket.id, status: 'online' },
      to: Recipient.id,
      time,
    }));
    if (Recipient.status === 'online') {
      socket.emit('message', {
        message: text,
        from: { ...User, socket_id: socket.id, status: 'online' },
      }, Recipient.socket_id);
    } else if (Recipient.status === 'group') {
      socket.emit('message', {
        message: text,
        from: { ...Recipient, sender: User.username },
      }, Recipient.socket_id);
    } else {
      socket.emit('offline-queue', {
        message: text,
        from: { ...User, socket_id: socket.id, status: 'online' },
        time,
        to: Recipient.id,
      });
    }
    setText('');
  };

  const handleChange = (event) => {
    setText(event.target.value);
  };

  const DisplayMessages = () => {
    let ChatsToDisplay = messages.map((ChatObject) => {
      if (ChatObject.from.id === Recipient.id || ChatObject.to === Recipient.id) {
        return ChatObject;
      }
      return null;
    });
    ChatsToDisplay = ChatsToDisplay.filter((object) => object !== null);
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
    });

    return chats;
  };

  const display = () => {
    if (Recipient === null) {
      return <p className={style.select_text}>Search and select a user to start messaging</p>;
    }
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

  return (
    display()
  );
};

export default Chat;
