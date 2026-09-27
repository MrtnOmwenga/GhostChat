import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  FaArrowLeftLong, FaPaperPlane, FaUserPlus, FaDoorOpen, FaKey,
} from 'react-icons/fa6';
import { toast } from 'react-toastify';
import ChatStyle from './Conversation.module.css';
import IconButton from '../../ui/IconButton';
import { sendText, leaveRoom } from '../../lib/messaging';
import { conversationClosed } from './chatSlice';
import InvitePanel from './InvitePanel';

const formatTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const Message = ({ record, fromMe, showSender }) => {
  if (record.kind === 'event') return <li className={ChatStyle.announcement}>{record.text}</li>;
  if (record.kind === 'deleted') {
    return <li className={`${ChatStyle.message} ${fromMe ? ChatStyle.fromMe : ChatStyle.fromThem} ${ChatStyle.deleted}`}>Message deleted</li>;
  }
  if (record.kind === 'unreadable') {
    return <li className={`${ChatStyle.message} ${ChatStyle.fromThem} ${ChatStyle.deleted}`}>This message could not be decrypted</li>;
  }
  return (
    <li className={`${ChatStyle.message} ${fromMe ? ChatStyle.fromMe : ChatStyle.fromThem}`}>
      {showSender && <span className={ChatStyle.sender}>{record.senderName}</span>}
      <span className={ChatStyle.text}>{record.text}</span>
      <time className={ChatStyle.time} dateTime={record.createdAt}>{formatTime(record.createdAt)}</time>
    </li>
  );
};

const Conversation = ({ user }) => {
  const [text, setText] = useState('');
  const [inviting, setInviting] = useState(false);
  const dispatch = useDispatch();
  const {
    active, contacts, messages, pending,
  } = useSelector((state) => state.chat);
  const contact = active ? contacts[active] : null;
  const records = (active && messages[active]) || [];
  const sending = (active && pending[active]) || [];
  const bottom = useRef(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [records.length, sending.length, active]);

  if (!contact) {
    return (
      <section className={ChatStyle.chat}>
        <p className={ChatStyle.placeholder}>Search and select a user to start messaging</p>
      </section>
    );
  }

  const isRoom = contact.kind === 'room';

  const submit = async (event) => {
    event.preventDefault();
    const message = text.trim();
    if (!message) return;
    setText('');
    try {
      await sendText(contact.conversation, message);
    } catch (error) {
      setText(message);
      toast.error(error.message);
    }
  };

  const leave = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Leave ${contact.name}? You'll need a new invite to come back.`)) return;
    try {
      await leaveRoom(contact.id);
    } catch (error) {
      toast.error(error.message);
    }
  };

  let status = contact.online ? 'Online' : 'Offline';
  if (isRoom) status = `${contact.members?.length || 0} members`;

  return (
    <section className={ChatStyle.chat} aria-label={`Conversation with ${contact.name}`}>
      <header className={ChatStyle.header}>
        <IconButton icon={FaArrowLeftLong} label="Back to conversations" className={ChatStyle.back} onClick={() => dispatch(conversationClosed())} />
        <div className={ChatStyle.headerText}>
          <p className={ChatStyle.name}>{contact.name}</p>
          <p className={ChatStyle.status}>
            {status}
            {isRoom && contact.fingerprint && (
              <span className={ChatStyle.fingerprint} title={`Room key fingerprint (key #${contact.epoch}). Members who see the same value share the same key.`}>
                <FaKey aria-hidden="true" />
                {' '}
                <span aria-label="Room key fingerprint">{contact.fingerprint}</span>
              </span>
            )}
          </p>
        </div>
        {isRoom && (
          <div className={ChatStyle.actions}>
            <IconButton icon={FaUserPlus} label="Invite people" onClick={() => setInviting(true)} />
            <IconButton icon={FaDoorOpen} label="Leave room" onClick={leave} />
          </div>
        )}
      </header>
      <ol className={ChatStyle.messages}>
        {records.map((record) => (
          <Message key={record.seq} record={record} fromMe={record.sender === user.id} showSender={isRoom && record.sender !== user.id} />
        ))}
        {sending.map((item) => (
          <li key={item.tempId} className={`${ChatStyle.message} ${ChatStyle.fromMe} ${ChatStyle.pending}`}>
            <span className={ChatStyle.text}>{item.text}</span>
            <span className={ChatStyle.time}>Sending…</span>
          </li>
        ))}
        <li ref={bottom} aria-hidden="true" />
      </ol>
      <form className={ChatStyle.composer} onSubmit={submit}>
        <label className="sr-only" htmlFor="message">Message</label>
        <input id="message" type="text" value={text} placeholder="Type a message" maxLength={4000} autoComplete="off" onChange={(e) => setText(e.target.value)} />
        <button type="submit" aria-label="Send"><FaPaperPlane aria-hidden="true" /></button>
      </form>
      {inviting && <InvitePanel room={contact} close={() => setInviting(false)} />}
    </section>
  );
};

export default Conversation;
