import React, { useState } from 'react';
import { toast } from 'react-toastify';
import style from './AuthPage.module.css';
import { unlock } from './accountFlows';

/** Shown when the session is valid but this browser has no unlocked keys (e.g. storage cleared). */
const UnlockPanel = ({ user, onUnlocked, onSignOut }) => {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await unlock(user, password);
      onUnlocked();
    } catch (error) {
      toast.error(error.message);
      setBusy(false);
    }
  };

  return (
    <div className={style.page}>
      <main className={style.card}>
        <h1 className={style.title}>Unlock</h1>
        <p className={style.lead}>{`Enter your password to unlock ${user.username}'s keys on this device.`}</p>
        <form className={style.form} onSubmit={submit}>
          <label className="sr-only" htmlFor="unlock-password">Password</label>
          <input id="unlock-password" className={style.input} type="password" placeholder="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="submit" className={style.primary} disabled={busy}>{busy ? 'Unlocking…' : 'Unlock'}</button>
        </form>
        <p className={style.switch}><button type="button" onClick={onSignOut}>Sign out</button></p>
      </main>
    </div>
  );
};

export default UnlockPanel;
