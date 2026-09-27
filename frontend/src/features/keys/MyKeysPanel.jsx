import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import panel from '../../ui/Panel.module.css';
import style from './Keys.module.css';
import KeyHistoryList from './KeyHistoryList';
import { keysOf } from '../../lib/messaging';
import { rotateKeys } from '../../lib/keys';
import { sodium as loadSodium, signingFingerprint, isValidPhrase, normalizePhrase } from '../../lib/crypto';

const REASONS = ['Routine rotation', 'Suspected compromise', 'Lost or stolen device'];

/** Your identity, key history, and key rotation (docs/DESIGN.md §5.2). */
const MyKeysPanel = ({ back, onReset }) => {
  const user = useSelector((state) => state.session.user);
  const changed = useSelector((state) => state.chat.keyChanges[user.id]);
  const [history, setHistory] = useState(null);
  const [fingerprint, setFingerprint] = useState('');
  const [rotating, setRotating] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [phrase, setPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const h = await keysOf(user.id);
      setHistory(h);
      setFingerprint(signingFingerprint(await loadSodium(), h.current.signingKey));
    })().catch((error) => toast.error(error.message));
  }, [user.id, changed]);

  const rotate = async (event) => {
    event.preventDefault();
    if (!isValidPhrase(phrase)) {
      toast.error("That isn't a valid recovery phrase");
      return;
    }
    setBusy(true);
    try {
      await rotateKeys(user, { password, phrase: normalizePhrase(phrase), reason });
      toast.success('Keys rotated. Your contacts will see it was signed by your previous key.');
      setRotating(false);
      setPhrase('');
      setPassword('');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  if (!history) return <p className={panel.note}>Loading your keys…</p>;

  return (
    <div className={style.keys}>
      <dl className={style.facts}>
        <dt>Identity</dt>
        <dd><code>{history.did}</code></dd>
        <dt>Current signing key</dt>
        <dd><code aria-label="Your key fingerprint">{fingerprint}</code>{` · version ${history.current.version}`}</dd>
      </dl>
      <KeyHistoryList events={history.events} />
      {rotating ? (
        <form className={panel.form} onSubmit={rotate}>
          <label htmlFor="rotate-reason">Reason</label>
          <select id="rotate-reason" className={style.select} value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
          <label htmlFor="rotate-phrase">Recovery phrase</label>
          <textarea id="rotate-phrase" className={style.textarea} autoComplete="off" autoCapitalize="none" spellCheck="false" value={phrase} onChange={(e) => setPhrase(e.target.value)} required />
          <label htmlFor="rotate-password">Password</label>
          <input id="rotate-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <p className={panel.note}>The phrase proves the new key is the one your current key committed to; the password re-encrypts your vault.</p>
          <div className={panel.actions}>
            <button type="button" className={panel.secondary} onClick={() => setRotating(false)}>Cancel</button>
            <button type="submit" className={panel.primary} disabled={busy}>{busy ? 'Rotating…' : 'Rotate keys'}</button>
          </div>
        </form>
      ) : (
        <div className={panel.actions}>
          <button type="button" className={panel.secondary} onClick={back}>Back</button>
          <button type="button" className={panel.secondary} onClick={onReset}>Lost your phrase?</button>
          <button type="button" className={panel.primary} onClick={() => setRotating(true)}>Rotate keys</button>
        </div>
      )}
    </div>
  );
};

export default MyKeysPanel;
