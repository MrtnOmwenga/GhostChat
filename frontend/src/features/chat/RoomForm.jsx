import React, { useState } from 'react';
import { toast } from 'react-toastify';
import panel from '../../ui/Panel.module.css';
import { acceptInvite, createRoom } from '../../lib/messaging';

/** Parses a pasted invite link: /join/<id>#<secret>. */
export const parseInvite = (link) => {
  const match = /\/join\/([0-9a-f]{24})#([A-Za-z0-9_-]{43})\s*$/.exec(link.trim());
  return match ? { id: match[1], secret: match[2] } : null;
};

const RoomForm = ({ mode, close, back }) => {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const creating = mode === 'create';

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (creating) {
        await createRoom(value.trim());
        toast.success('Room created');
      } else {
        const invite = parseInvite(value);
        if (!invite) throw new Error("That doesn't look like a complete invite link");
        await acceptInvite(invite.id, invite.secret);
        toast.success('Joined room');
      }
      close();
    } catch (error) {
      toast.error(error.message);
      setBusy(false);
    }
  };

  return (
    <form className={panel.form} onSubmit={submit}>
      <label htmlFor="room-field">{creating ? 'Room name' : 'Invite link'}</label>
      <input id="room-field" type="text" value={value} maxLength={creating ? 48 : 300} onChange={(e) => setValue(e.target.value)} required autoFocus />
      {!creating && <p className={panel.note}>Paste the link a member shared with you.</p>}
      <div className={panel.actions}>
        <button type="button" className={panel.secondary} onClick={back}>Back</button>
        <button type="submit" className={panel.primary} disabled={busy}>{creating ? 'Create' : 'Join'}</button>
      </div>
    </form>
  );
};

export default RoomForm;
