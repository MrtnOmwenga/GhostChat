import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import panel from '../../ui/Panel.module.css';
import PasswordField from './PasswordField';
import { changePassword } from './accountFlows';

const ChangePasswordForm = ({ close, back }) => {
  const user = useSelector((state) => state.session.user);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [strong, setStrong] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!strong) {
      toast.error('Choose a stronger password');
      return;
    }
    setBusy(true);
    try {
      await changePassword(user, current, next);
      toast.success('Password changed');
      close();
    } catch (error) {
      toast.error(error.message);
      setBusy(false);
    }
  };

  return (
    <form className={panel.form} onSubmit={submit}>
      <label htmlFor="current-password">Current password</label>
      <input id="current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      <label htmlFor="new-password">New password</label>
      <PasswordField id="new-password" label="New password" value={next} onChange={setNext} userInputs={[user.username]} onStrength={setStrong} />
      <div className={panel.actions}>
        <button type="button" className={panel.secondary} onClick={back}>Back</button>
        <button type="submit" className={panel.primary} disabled={busy}>{busy ? 'Saving…' : 'Change'}</button>
      </div>
    </form>
  );
};

export default ChangePasswordForm;
