import React, {
  lazy, Suspense, useCallback, useEffect, useRef, useState,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  FaArrowLeftLong, FaPaperPlane, FaUserPlus, FaDoorOpen, FaKey, FaRegFaceSmile, FaLink, FaShieldHalved, FaTriangleExclamation,
} from 'react-icons/fa6';
import { toast } from 'react-toastify';
import ChatStyle from './Conversation.module.css';
import IconButton from '../../ui/IconButton';
import { sendText, leaveRoom } from '../../lib/messaging';
import { conversationClosed } from './chatSlice';
import InvitePanel from './InvitePanel';
import { isEmojiOnly } from '../../lib/emoji';
import { trustOf } from './trust';
import VerifyDrawer from './VerifyDrawer';
import ChainView from './ChainView';

const EmojiPicker = lazy(() => import('./EmojiPicker'));

const formatTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const Shield = ({ record, onVerify }) => {
  const trust = trustOf(record);
  const Icon = trust.level === 'bad' ? FaTriangleExclamation : FaShieldHalved;
  return (
    <button type="button" className={`${ChatStyle.shield} ${ChatStyle[trust.level]}`} onClick={onVerify} aria-label={`Verify message ${record.seq}: ${trust.label}`} title={trust.label}>
      <Icon aria-hidden="true" />
    </button>
  );
};

const Message = ({
  record, fromMe, showSender, onVerify,
}) => {
  if (record.kind === 'event') {
    return (
      <li className={ChatStyle.announcement}>
        {record.text}
        {' '}
        <Shield record={record} onVerify={onVerify} />
      </li>
    );
  }
  const side = fromMe ? ChatStyle.fromMe : ChatStyle.fromThem;
  if (record.kind === 'deleted' || record.kind === 'unreadable') {
    return (
      <li className={`${ChatStyle.message} ${record.kind === 'deleted' ? side : ChatStyle.fromThem} ${ChatStyle.deleted}`}>
        <span className={ChatStyle.text}>{record.kind === 'deleted' ? 'Message deleted' : 'This message could not be decrypted'}</span>
        <span className={ChatStyle.meta}><Shield record={record} onVerify={onVerify} /></span>
      </li>
    );
  }
  const big = isEmojiOnly(record.text);
  return (
    <li className={`${ChatStyle.message} ${side} ${big ? ChatStyle.bigEmoji : ''}`}>
      {showSender && <span className={ChatStyle.sender}>{record.senderName}</span>}
      <span className={ChatStyle.text}>{record.text}</span>
      <span className={ChatStyle.meta}>
        <time className={ChatStyle.time} dateTime={record.createdAt}>{formatTime(record.createdAt)}</time>
        <Shield record={record} onVerify={onVerify} />
      </span>
    </li>
  );
};

const Conversation = ({ user }) => {
  const [text, setText] = useState('');
  const [inviting, setInviting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [verifying, setVerifying] = useState(null); // seq of the message shown in the Verify drawer
  const [chainOpen, setChainOpen] = useState(false);
  const input = useRef(null);
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

  // The composer grows with its content up to about six lines, then scrolls.
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const insertEmoji = useCallback((emoji) => {
    const el = input.current;
    setText((current) => {
      if (!el) return current + emoji;
      const start = el.selectionStart ?? current.length;
      const end = el.selectionEnd ?? current.length;
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + emoji.length, start + emoji.length);
      });
      return current.slice(0, start) + emoji + current.slice(end);
    });
  }, []);
  const closePicker = useCallback(() => setPicking(false), []);
  const closeVerify = useCallback(() => setVerifying(null), []);
  const closeChain = useCallback(() => setChainOpen(false), []);

  if (!contact) {
    return (
      <section className={ChatStyle.chat}>
        <p className={ChatStyle.placeholder}>Search and select a user to start messaging</p>
      </section>
    );
  }

  const isRoom = contact.kind === 'room';

  const submit = async (event) => {
    event?.preventDefault();
    setPicking(false);
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
  if (isRoom) {
    const count = contact.members?.length || 0;
    status = `${count} ${count === 1 ? 'member' : 'members'}`;
  }

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
        <div className={ChatStyle.actions}>
          <IconButton icon={FaLink} label="Show the message chain" onClick={() => setChainOpen(true)} />
          {isRoom && <IconButton icon={FaUserPlus} label="Invite people" onClick={() => setInviting(true)} />}
          {isRoom && <IconButton icon={FaDoorOpen} label="Leave room" onClick={leave} />}
        </div>
      </header>
      <ol className={ChatStyle.messages}>
        {records.map((record) => (
          <Message key={record.seq} record={record} fromMe={record.sender === user.id} showSender={isRoom && record.sender !== user.id} onVerify={() => setVerifying(record.seq)} />
        ))}
        {sending.map((item) => (
          <li key={item.tempId} className={`${ChatStyle.message} ${ChatStyle.fromMe} ${ChatStyle.pending} ${isEmojiOnly(item.text) ? ChatStyle.bigEmoji : ''}`}>
            <span className={ChatStyle.text}>{item.text}</span>
            <span className={ChatStyle.time}>Sending…</span>
          </li>
        ))}
        <li ref={bottom} aria-hidden="true" />
      </ol>
      {picking && (
        <Suspense fallback={null}>
          <EmojiPicker onPick={insertEmoji} close={closePicker} />
        </Suspense>
      )}
      <form className={ChatStyle.composer} onSubmit={submit}>
        <button type="button" aria-label="Emoji" aria-expanded={picking} onClick={() => setPicking(!picking)}><FaRegFaceSmile aria-hidden="true" /></button>
        <label className="sr-only" htmlFor="message">Message</label>
        <textarea
          id="message"
          ref={input}
          rows={1}
          value={text}
          placeholder="Type a message"
          maxLength={4000}
          autoComplete="off"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter starts a new line.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button type="submit" aria-label="Send"><FaPaperPlane aria-hidden="true" /></button>
      </form>
      {inviting && <InvitePanel room={contact} close={() => setInviting(false)} />}
      {chainOpen && (
        <ChainView conversation={contact.conversation} title={contact.name} close={closeChain} onSelect={(seq) => { setChainOpen(false); setVerifying(seq); }} />
      )}
      {verifying !== null && records.find((r) => r.seq === verifying) && (
        <VerifyDrawer
          record={records.find((r) => r.seq === verifying)}
          previous={records.find((r) => r.seq === verifying - 1)}
          conversation={contact.conversation}
          isMine={records.find((r) => r.seq === verifying).sender === user.id}
          close={closeVerify}
        />
      )}
    </section>
  );
};

export default Conversation;
