import React, {
  lazy, Suspense, useCallback, useEffect, useRef, useState,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  FaArrowLeftLong, FaPaperPlane, FaUserPlus, FaDoorOpen, FaKey, FaRegFaceSmile, FaLink, FaShieldHalved, FaTriangleExclamation, FaFingerprint, FaPaperclip, FaXmark,
} from 'react-icons/fa6';
import { toast } from 'react-toastify';
import ChatStyle from './Conversation.module.css';
import IconButton from '../../ui/IconButton';
import { sendText, sendFile, leaveRoom } from '../../lib/messaging';
import Attachment, { Lightbox } from './Attachment';
import { formatBytes } from '../../lib/media';
import { conversationClosed } from './chatSlice';
import InvitePanel from './InvitePanel';
import { isEmojiOnly } from '../../lib/emoji';
import { trustOf } from './trust';
import VerifyDrawer from './VerifyDrawer';
import ChainView from './ChainView';
import ContactKeysPanel from '../keys/ContactKeysPanel';
import { keysOf } from '../../lib/messaging';
import { verificationStatus, pinsSynced } from '../../lib/keys';

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

const Ticks = ({ readers }) => (
  <span className={`${ChatStyle.ticks} ${readers.length ? ChatStyle.read : ''}`} aria-label={readers.length ? `Read by ${readers.join(', ')}` : 'Delivered'} title={readers.length ? `Read by ${readers.join(', ')}` : 'Delivered'}>
    {readers.length ? '✓✓' : '✓'}
  </span>
);

const Message = ({
  record, fromMe, showSender, onVerify, readers, onOpenImage,
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
  const big = record.kind === 'text' && isEmojiOnly(record.text);
  return (
    <li className={`${ChatStyle.message} ${side} ${big ? ChatStyle.bigEmoji : ''}`}>
      {showSender && <span className={ChatStyle.sender}>{record.senderName}</span>}
      {record.kind === 'file' && <Attachment file={record.file} onOpenImage={onOpenImage} />}
      {record.text && <span className={ChatStyle.text}>{record.text}</span>}
      <span className={ChatStyle.meta}>
        <time className={ChatStyle.time} dateTime={record.createdAt}>{formatTime(record.createdAt)}</time>
        {readers && <Ticks readers={readers} />}
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
  const [keysOpen, setKeysOpen] = useState(false);
  const [keyNotice, setKeyNotice] = useState(null);
  const [attachment, setAttachment] = useState(null); // a File chosen, pasted or dropped
  const [image, setImage] = useState(null); // { url, file } shown full size
  const filePicker = useRef(null);
  const keyChange = useSelector((state) => {
    const open = state.chat.active && state.chat.contacts[state.chat.active];
    return open?.kind === 'user' ? state.chat.keyChanges[open.id] : undefined;
  });
  const input = useRef(null);
  const dispatch = useDispatch();
  const {
    active, contacts, messages, pending, receipts,
  } = useSelector((state) => state.chat);
  const receiptsOn = useSelector((state) => state.session.user?.receiptsEnabled === true);
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

  // What a DM partner's key history says about them: verified contacts whose keys changed without
  // authorisation get a warning; a reset or rotation since the start is shown as a notice.
  const peerId = contact?.kind === 'user' ? contact.id : null;
  useEffect(() => {
    setKeyNotice(null);
    if (!peerId) return;
    Promise.all([keysOf(peerId), pinsSynced()]).then(([history]) => {
      const status = verificationStatus(user.id, peerId, history);
      const last = history.events[history.events.length - 1];
      if (!history.ok) setKeyNotice({ level: 'bad', text: `This person's key history does not verify: ${history.problems[0]}` });
      else if (status === 'changed') setKeyNotice({ level: 'bad', text: 'Their keys changed in a way the key you verified did not authorise. Compare safety numbers again.' });
      else if (last.type === 'reset') setKeyNotice({ level: 'warn', text: `Keys were reset on ${new Date(last.createdAt).toLocaleDateString()}: compare safety numbers before sharing anything sensitive.` });
      else if (last.type === 'rotate') setKeyNotice({ level: 'info', text: `Keys rotated on ${new Date(last.createdAt).toLocaleDateString()} · signed by their previous key ✓` });
    }).catch(() => {});
  }, [peerId, user.id, keyChange, keysOpen]);

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
  const closeImage = useCallback(() => setImage(null), []);
  useEffect(() => setAttachment(null), [active]);

  if (!contact) {
    return (
      <section className={ChatStyle.chat}>
        <p className={ChatStyle.placeholder}>Search and select a user to start messaging</p>
      </section>
    );
  }

  const isRoom = contact.kind === 'room';
  const memberName = (id) => (isRoom ? contact.members?.find((m) => m.id === id)?.username : contact.name) || 'someone';
  // Names of everyone whose signed, verified receipt covers message `seq` (receipts are reciprocal:
  // only shown to users who have them on).
  const readersOf = (seq) => (receiptsOn
    ? Object.entries(receipts[contact.conversation] || {})
      .filter(([reader, r]) => reader !== user.id && r.verified && r.upToSeq >= seq)
      .map(([reader]) => memberName(reader))
    : null);

  const submit = async (event) => {
    event?.preventDefault();
    setPicking(false);
    const message = text.trim();
    const file = attachment;
    if (!message && !file) return;
    setText('');
    setAttachment(null);
    try {
      if (file) await sendFile(contact.conversation, file, message);
      else await sendText(contact.conversation, message);
    } catch (error) {
      setText(message);
      setAttachment(file);
      toast.error(error.message);
    }
  };
  const pickFirst = (files) => {
    if (files?.length) setAttachment(files[0]);
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
    <section
      className={ChatStyle.chat}
      aria-label={`Conversation with ${contact.name}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        pickFirst(e.dataTransfer.files);
      }}
    >
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
          {!isRoom && <IconButton icon={FaFingerprint} label="Keys and safety number" onClick={() => setKeysOpen(true)} />}
          <IconButton icon={FaLink} label="Show the message chain" onClick={() => setChainOpen(true)} />
          {isRoom && <IconButton icon={FaUserPlus} label="Invite people" onClick={() => setInviting(true)} />}
          {isRoom && <IconButton icon={FaDoorOpen} label="Leave room" onClick={leave} />}
        </div>
      </header>
      {keyNotice && (
        <p className={`${ChatStyle.keyNotice} ${ChatStyle[`notice_${keyNotice.level}`]}`} role={keyNotice.level === 'bad' ? 'alert' : 'status'}>
          {keyNotice.text}
          {' '}
          <button type="button" onClick={() => setKeysOpen(true)}>View keys</button>
        </p>
      )}
      <ol className={ChatStyle.messages}>
        {records.map((record) => (
          <Message key={record.seq} record={record} fromMe={record.sender === user.id} showSender={isRoom && record.sender !== user.id} onVerify={() => setVerifying(record.seq)} readers={record.sender === user.id ? readersOf(record.seq) : null} onOpenImage={setImage} />
        ))}
        {sending.map((item) => (
          <li key={item.tempId} className={`${ChatStyle.message} ${ChatStyle.fromMe} ${ChatStyle.pending} ${!item.file && isEmojiOnly(item.text) ? ChatStyle.bigEmoji : ''}`}>
            {item.file?.previewUrl && <img className={ChatStyle.pendingImage} src={item.file.previewUrl} alt="" />}
            {item.file && !item.file.previewUrl && <span className={ChatStyle.text}>{`📎 ${item.file.name}`}</span>}
            {item.text && <span className={ChatStyle.text}>{item.text}</span>}
            <span className={ChatStyle.time}>{item.file ? 'Encrypting and sending…' : 'Sending…'}</span>
          </li>
        ))}
        <li ref={bottom} aria-hidden="true" />
      </ol>
      {picking && (
        <Suspense fallback={null}>
          <EmojiPicker onPick={insertEmoji} close={closePicker} />
        </Suspense>
      )}
      {attachment && (
        <div className={ChatStyle.attachmentChip}>
          <FaPaperclip aria-hidden="true" />
          <span className={ChatStyle.chipName} aria-label="Attachment to send">{attachment.name}</span>
          <span className={ChatStyle.chipSize}>{formatBytes(attachment.size)}</span>
          <IconButton icon={FaXmark} label="Remove attachment" onClick={() => setAttachment(null)} />
        </div>
      )}
      <form className={ChatStyle.composer} onSubmit={submit}>
        <button type="button" aria-label="Emoji" aria-expanded={picking} onClick={() => setPicking(!picking)}><FaRegFaceSmile aria-hidden="true" /></button>
        <button type="button" aria-label="Attach a file" className={ChatStyle.attach} onClick={() => filePicker.current?.click()}><FaPaperclip aria-hidden="true" /></button>
        <input
          ref={filePicker}
          type="file"
          hidden
          data-testid="file-input"
          onChange={(e) => {
            pickFirst(e.target.files);
            e.target.value = '';
          }}
        />
        <label className="sr-only" htmlFor="message">Message</label>
        <textarea
          id="message"
          ref={input}
          rows={1}
          value={text}
          placeholder={attachment ? 'Add a caption' : 'Type a message'}
          maxLength={4000}
          autoComplete="off"
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            if (!e.clipboardData.files.length) return;
            e.preventDefault();
            pickFirst(e.clipboardData.files);
          }}
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
      {image && <Lightbox image={image} close={closeImage} />}
      {inviting && <InvitePanel room={contact} close={() => setInviting(false)} />}
      {keysOpen && <ContactKeysPanel contact={contact} close={() => setKeysOpen(false)} />}
      {chainOpen && (
        <ChainView conversation={contact.conversation} title={contact.name} close={closeChain} onSelect={(seq) => { setChainOpen(false); setVerifying(seq); }} />
      )}
      {verifying !== null && records.find((r) => r.seq === verifying) && (
        <VerifyDrawer
          record={records.find((r) => r.seq === verifying)}
          previous={records.find((r) => r.seq === verifying - 1)}
          conversation={contact.conversation}
          isMine={records.find((r) => r.seq === verifying).sender === user.id}
          readers={readersOf(verifying)}
          close={closeVerify}
        />
      )}
    </section>
  );
};

export default Conversation;
