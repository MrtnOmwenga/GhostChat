import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import ChatStyle from '../assets/style/chat.module.css';
import { sendMessage } from '../socket';

const formatTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const Chat = ({ user }) => {
  const [text, setText] = useState('');
  const { active, contacts, messages } = useSelector((state) => state.chat);
  const contact = active ? contacts[active] : null;
  const conversation = (active && messages[active]) || [];
  const bottom = useRef(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [conversation.length, active]);

  if (!contact) {
    return <p className={ChatStyle.select_text}>Search and select a user to start messaging</p>;
  }

  // The message appears once the server echoes it back, so what's shown is what was stored.
  const submit = async (event) => {
    event.preventDefault();
    if (!text.trim()) return;
    try {
      await sendMessage(contact.kind === 'room' ? { room: contact.id } : { to: contact.id }, text);
      setText('');
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className={ChatStyle.chat}>
      <div className={ChatStyle.ChatContainer}>
        {conversation.map((message) => {
          if (message.announcement) {
            return (
              <div key={message.id} className={ChatStyle.message_container}>
                <p className={ChatStyle.announcement}>{message.text}</p>
              </div>
            );
          }
          const fromMe = message.from.id === user.id;
          return (
            <div key={message.id} className={ChatStyle.message_container}>
              <p className={`${ChatStyle.message} ${fromMe ? ChatStyle.from_me : ChatStyle.not_from_me}`}>
                {!fromMe && contact.kind === 'room' && (
                  <span>
                    {message.from.username}
                    <br />
                  </span>
                )}
                {message.text}
                <br />
                <span>{formatTime(message.createdAt)}</span>
              </p>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <form onSubmit={submit}>
        <input type="text" value={text} placeholder="Type a message" maxLength={2000} onChange={(e) => setText(e.target.value)} />
        <button type="submit" aria-label="Send">{' '}</button>
      </form>
    </div>
  );
};

export default Chat;
