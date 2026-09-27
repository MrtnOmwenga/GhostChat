import React, { useEffect, useState } from 'react';
import { FaXmark, FaRegCopy } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import panel from '../../ui/Panel.module.css';
import IconButton from '../../ui/IconButton';
import { createInvite } from '../../lib/messaging';

/** Creates an invite link. Its secret sits after the '#', which never reaches the server. */
const InvitePanel = ({ room, close }) => {
  const [singleUse, setSingleUse] = useState(false);
  const [invite, setInvite] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const create = async () => {
    setBusy(true);
    try {
      setInvite(await createInvite(room.id, { singleUse }));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={panel.backdrop} onClick={close} role="presentation">
      <div className={panel.panel} role="dialog" aria-modal="true" aria-labelledby="invite-title" onClick={(e) => e.stopPropagation()}>
        <div className={panel.header}>
          <h2 id="invite-title">{`Invite to ${room.name}`}</h2>
          <IconButton icon={FaXmark} label="Close" onClick={close} />
        </div>
        {invite ? (
          <div className={panel.form}>
            <label htmlFor="invite-link">Invite link</label>
            <input id="invite-link" type="text" readOnly value={invite.link} onFocus={(e) => e.target.select()} />
            <p className={panel.note}>
              {`Anyone with this link can join and read the room's history until ${new Date(invite.expiresAt).toLocaleString()}. Share it privately.`}
            </p>
            <div className={panel.actions}>
              <button type="button" className={panel.primary} onClick={() => navigator.clipboard?.writeText(invite.link).then(() => toast.success('Link copied'))}>
                <FaRegCopy aria-hidden="true" />
                {' '}
                Copy link
              </button>
            </div>
          </div>
        ) : (
          <div className={panel.form}>
            <p className={panel.note}>The link works for 7 days, and stops working if the room key is replaced (for example when someone leaves).</p>
            <label className={panel.checkbox} htmlFor="single-use">
              <input id="single-use" type="checkbox" checked={singleUse} onChange={(e) => setSingleUse(e.target.checked)} />
              Single use
            </label>
            <div className={panel.actions}>
              <button type="button" className={panel.primary} disabled={busy} onClick={create}>{busy ? 'Creating…' : 'Create link'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvitePanel;
