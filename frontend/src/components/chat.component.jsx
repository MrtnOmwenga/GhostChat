import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaArrowLeftLong, FaPaperPlane } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import ChatStyle from '../assets/style/chat.module.css';
import IconButton from './icon-button.component';
import { sendMessage } from '../socket';
import { conversationClosed } from '../store/chat';

const formatTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const Chat = ({ user }) => {
  const [text, setText] = useState('');
  const dispatch = useDispatch();
  const { active, contacts, messages } = useSelector((state) => state.chat);
  const contact = active ? contacts[active] : null;
  const conversation = (active && messages[active]) || [];
  const bottom = useRef(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [conversation.length, active]);

  if (!contact) {
    return (
      <section className={ChatStyle.chat}>
        <p className={ChatStyle.placeholder}>Search and select a user to start messaging</p>
      </section>
    );
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
    <section className={ChatStyle.chat} aria-label={`Conversation with ${contact.name}`}>
      <header className={ChatStyle.header}>
        <IconButton icon={FaArrowLeftLong} label="Back to conversations" className={ChatStyle.back} onClick={() => dispatch(conversationClosed())} />
        <div>
          <p className={ChatStyle.name}>{contact.name}</p>
          <p className={ChatStyle.status}>
            {contact.kind === 'room' ? 'Room' : (contact.online ? 'Online' : 'Offline')}
          </p>
        </div>
      </header>
      <ol className={ChatStyle.messages}>
        {conversation.map((message) => {
          if (message.announcement) {
            return <li key={message.id} className={ChatStyle.announcement}>{message.text}</li>;
          }
          const fromMe = message.from.id === user.id;
          return (
            <li key={message.id} className={`${ChatStyle.message} ${fromMe ? ChatStyle.fromMe : ChatStyle.fromThem}`}>
              {!fromMe && contact.kind === 'room' && <span className={ChatStyle.sender}>{message.from.username}</span>}
              <span className={ChatStyle.text}>{message.text}</span>
              <time className={ChatStyle.time} dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
            </li>
          );
        })}
        <li ref={bottom} aria-hidden="true" />
      </ol>
      <form className={ChatStyle.composer} onSubmit={submit}>
        <label className="sr-only" htmlFor="message">Message</label>
        <input id="message" type="text" value={text} placeholder="Type a message" maxLength={2000} autoComplete="off" onChange={(e) => setText(e.target.value)} />
        <button type="submit" aria-label="Send"><FaPaperPlane aria-hidden="true" /></button>
      </form>
    </section>
  );
};

export default Chat;
