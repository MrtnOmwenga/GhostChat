import React, { useEffect, useState } from 'react';
import { FaXmark, FaShieldHalved, FaTriangleExclamation } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import IconButton from '../../ui/IconButton';
import style from './VerifyDrawer.module.css';
import { trustOf } from './trust';
import { deleteMessage } from '../../lib/messaging';

const short = (hash) => (hash ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : '—');

const Row = ({ label, children }) => (
  <div className={style.row}>
    <dt>{label}</dt>
    <dd>{children}</dd>
  </div>
);

/** Everything a user needs to check one message themselves: hashes, link, signature, raw envelope. */
const VerifyDrawer = ({
  record, previous, conversation, isMine, readers, close,
}) => {
  const [busy, setBusy] = useState(false);
  const trust = trustOf(record);
  const v = record.verification || {};

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const remove = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Delete this message for everyone? Its content is erased; a signed marker stays in its place.')) return;
    setBusy(true);
    try {
      await deleteMessage(conversation, record.seq);
      toast.success('Message deleted');
      close();
    } catch (error) {
      toast.error(error.message);
      setBusy(false);
    }
  };

  let linkText = 'Not checked: the previous message is not loaded';
  if (v.link === true) linkText = record.seq === 1 ? 'First message of the conversation ✓' : `Links to #${record.seq - 1} ✓`;
  if (v.link === false) linkText = `Does not link to #${record.seq - 1}`;

  return (
    <div className={style.backdrop} onClick={close} role="presentation">
      <aside className={style.drawer} role="dialog" aria-modal="true" aria-labelledby="verify-title" onClick={(e) => e.stopPropagation()}>
        <header className={style.header}>
          <h2 id="verify-title">{`Message #${record.seq}`}</h2>
          <IconButton icon={FaXmark} label="Close" onClick={close} />
        </header>
        <p className={`${style.verdict} ${style[trust.level]}`}>
          {trust.level === 'bad' ? <FaTriangleExclamation aria-hidden="true" /> : <FaShieldHalved aria-hidden="true" />}
          {' '}
          {trust.label}
        </p>
        <dl className={style.facts}>
          <Row label="From">{`${record.senderName} · key version ${record.senderKeyVersion}`}</Row>
          <Row label="Sent">{new Date(record.createdAt).toLocaleString()}</Row>
          {record.epoch && <Row label="Room key">{`Epoch ${record.epoch}`}</Row>}
          <Row label="Hash"><code title={record.hash}>{short(record.hash)}</code></Row>
          <Row label="Previous"><code title={record.prev}>{short(record.prev)}</code></Row>
          <Row label="Chain link">{linkText}</Row>
          <Row label="Signature">
            {v.signature === true ? 'Ed25519 signature matches the sender’s key ✓' : 'Does not verify'}
          </Row>
          {record.kind === 'deleted' && (
            <Row label="Deleted">{`${record.deleted.type === 'account-deleted' ? 'Account deleted' : 'Deleted by the author'} · ${new Date(record.deleted.at).toLocaleString()}`}</Row>
          )}
          {isMine && readers && (
            <Row label="Read by">{readers.length ? `${readers.join(', ')} (signed receipts ✓)` : 'Nobody yet'}</Row>
          )}
          {previous && v.link === false && (
            <Row label="Expected"><code title={previous.hash}>{short(previous.hash)}</code></Row>
          )}
        </dl>
        {v.problems?.length > 0 && (
          <ul className={style.problems} aria-label="Problems">
            {v.problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
        <details className={style.raw}>
          <summary>Raw envelope</summary>
          <pre>{JSON.stringify(record.envelope, null, 2)}</pre>
        </details>
        {isMine && record.kind !== 'deleted' && (
          <button type="button" className={style.danger} disabled={busy} onClick={remove}>Delete message</button>
        )}
      </aside>
    </div>
  );
};

export default VerifyDrawer;
