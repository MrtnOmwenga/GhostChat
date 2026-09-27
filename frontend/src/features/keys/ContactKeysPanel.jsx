import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { FaXmark } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import QRCode from 'qrcode';
import panel from '../../ui/Panel.module.css';
import IconButton from '../../ui/IconButton';
import style from './Keys.module.css';
import KeyHistoryList from './KeyHistoryList';
import { keysOf } from '../../lib/messaging';
import { markVerified, unmarkVerified, verificationStatus } from '../../lib/keys';
import { sodium as loadSodium, safetyNumber, signingFingerprint } from '../../lib/crypto';

/**
 * A contact's keys and the safety number to compare in person (docs/DESIGN.md §5.4). Marking a
 * contact verified pins their current key in this browser.
 */
const ContactKeysPanel = ({ contact, close }) => {
  const me = useSelector((state) => state.session.user);
  const changed = useSelector((state) => state.chat.keyChanges[contact.id]);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    (async () => {
      const sodium = await loadSodium();
      const [theirs, mine] = await Promise.all([keysOf(contact.id), keysOf(me.id)]);
      const number = safetyNumber(sodium, { did: mine.did, signingKey: mine.current.signingKey }, { did: theirs.did, signingKey: theirs.current.signingKey });
      setData({
        history: theirs, number, fingerprint: signingFingerprint(sodium, theirs.current.signingKey), qr: await QRCode.toDataURL(number, { margin: 1, width: 180 }),
      });
      setStatus(verificationStatus(me.id, contact.id, theirs));
    })().catch((error) => toast.error(error.message));
    const onKey = (event) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [contact.id, me.id, changed, close]);

  const toggle = () => {
    if (status === 'verified') {
      unmarkVerified(me.id, contact.id);
      setStatus(null);
    } else {
      markVerified(me.id, contact.id, data.history);
      setStatus('verified');
      toast.success(`${contact.name} marked as verified`);
    }
  };

  return (
    <div className={panel.backdrop} onClick={close} role="presentation">
      <div className={panel.panel} role="dialog" aria-modal="true" aria-labelledby="contact-keys-title" onClick={(e) => e.stopPropagation()}>
        <div className={panel.header}>
          <h2 id="contact-keys-title">{`${contact.name}'s keys`}</h2>
          <IconButton icon={FaXmark} label="Close" onClick={close} />
        </div>
        {!data ? <p className={panel.note}>Loading keys…</p> : (
          <div className={style.keys}>
            {!data.history.ok && <p className={style.alert}>{`This key history does not verify: ${data.history.problems[0]}`}</p>}
            {status === 'changed' && <p className={style.alert}>Their keys changed in a way the key you verified did not authorise. Compare safety numbers again.</p>}
            {status === 'verified' && <p className={style.good}>Verified: you compared safety numbers with this key (or keys it authorised).</p>}
            <dl className={style.facts}>
              <dt>Identity</dt>
              <dd><code>{data.history.did}</code></dd>
              <dt>Current signing key</dt>
              <dd><code>{data.fingerprint}</code>{` · version ${data.history.current.version}`}</dd>
            </dl>
            <KeyHistoryList events={data.history.events} />
            <h3 className={style.subhead}>Safety number</h3>
            <p className={panel.note}>{`Compare this with ${contact.name} in person or on a call. If it matches on both screens, nobody is intercepting your messages.`}</p>
            <div className={style.safety}>
              <code aria-label="Safety number">{data.number}</code>
              <img src={data.qr} alt="Safety number as a QR code" width="180" height="180" />
            </div>
            <div className={panel.actions}>
              <button type="button" className={status === 'verified' ? panel.secondary : panel.primary} onClick={toggle}>
                {status === 'verified' ? 'Unmark as verified' : 'Mark as verified'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactKeysPanel;
