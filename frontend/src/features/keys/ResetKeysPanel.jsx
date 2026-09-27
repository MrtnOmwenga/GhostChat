import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import panel from '../../ui/Panel.module.css';
import PhraseSetup from '../auth/PhraseSetup';
import { resetKeys } from '../../lib/keys';

/**
 * For a lost recovery phrase: new keys from a new phrase. Nothing links them to the old keys
 * except the server's word, so contacts are warned and asked to compare safety numbers.
 */
const ResetKeysPanel = ({ back, close }) => {
  const user = useSelector((state) => state.session.user);
  const [password, setPassword] = useState('');
  const [step, setStep] = useState('warn');
  const [busy, setBusy] = useState(false);

  const reset = async (newPhrase) => {
    setBusy(true);
    try {
      await resetKeys(user, { password, newPhrase, reason: 'Lost recovery phrase' });
      toast.success('Keys reset. Ask your contacts to compare safety numbers with you.');
      close();
    } catch (error) {
      toast.error(error.message);
      setBusy(false);
      setStep('warn');
    }
  };

  if (step === 'phrase') {
    return <PhraseSetup onConfirmed={reset} busy={busy} busyLabel="Resetting…" confirmLabel="Reset keys" />;
  }

  return (
    <form className={panel.form} onSubmit={(e) => { e.preventDefault(); setStep('phrase'); }}>
      <p className={panel.note}>
        Use this only if you&apos;ve lost your recovery phrase. You&apos;ll get new keys and a new phrase. Everyone you
        talk to will see that your keys were reset (not rotated) and should compare safety numbers with you again.
        Your history stays readable.
      </p>
      <label htmlFor="reset-password">Password</label>
      <input id="reset-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <div className={panel.actions}>
        <button type="button" className={panel.secondary} onClick={back}>Back</button>
        <button type="submit" className={panel.danger}>Continue</button>
      </div>
    </form>
  );
};

export default ResetKeysPanel;
