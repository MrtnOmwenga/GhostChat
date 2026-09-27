import React, { useMemo, useState } from 'react';
import { FaRegCopy } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import style from './AuthPage.module.css';
import { generatePhrase } from '../../lib/crypto/phrase';

const pickThree = () => {
  const picks = new Set();
  while (picks.size < 3) picks.add(Math.floor(Math.random() * 24));
  return [...picks].sort((a, b) => a - b);
};

/**
 * Shows a new 24-word recovery phrase, then asks for three of its words before calling
 * `onConfirmed(phrase)`. Used at sign-up and when resetting keys.
 */
const PhraseSetup = ({ onConfirmed, busy, busyLabel, confirmLabel }) => {
  const [step, setStep] = useState('show');
  const [written, setWritten] = useState(false);
  const [answers, setAnswers] = useState({});
  const phrase = useMemo(() => generatePhrase(), []);
  const words = phrase.split(' ');
  const checks = useMemo(() => pickThree(), []);

  const confirm = (event) => {
    event.preventDefault();
    const wrong = checks.find((i) => (answers[i] || '').trim().toLowerCase() !== words[i]);
    if (wrong !== undefined) {
      toast.error(`Word #${wrong + 1} doesn't match. Check what you wrote down.`);
      return;
    }
    onConfirmed(phrase);
  };

  if (step === 'show') {
    return (
      <>
        <h1 className={style.title}>Recovery phrase</h1>
        <p className={style.lead}>
          These 24 words are the only way back into your account if you forget your password.
          Write them down and keep them somewhere safe. Nobody, including GhostChat, can recover them for you.
        </p>
        <ol className={style.phrase} aria-label="Recovery phrase">
          {words.map((word, i) => (
            // The phrase never changes while shown, so the index is a stable key.
            // eslint-disable-next-line react/no-array-index-key
            <li key={i}><span>{i + 1}</span>{word}</li>
          ))}
        </ol>
        <button type="button" className={style.secondary} onClick={() => navigator.clipboard?.writeText(phrase).then(() => toast.info('Copied. Paste it somewhere safe, then clear your clipboard.'))}>
          <FaRegCopy aria-hidden="true" />
          {' '}
          Copy
        </button>
        <label className={style.checkbox} htmlFor="written">
          <input id="written" type="checkbox" checked={written} onChange={(e) => setWritten(e.target.checked)} />
          I&apos;ve written down my recovery phrase
        </label>
        <button type="button" className={style.primary} disabled={!written} onClick={() => setStep('confirm')}>Continue</button>
      </>
    );
  }

  return (
    <>
      <h1 className={style.title}>Confirm your phrase</h1>
      <p className={style.lead}>Enter these words from your recovery phrase.</p>
      <form className={style.form} onSubmit={confirm}>
        {checks.map((i) => (
          <React.Fragment key={i}>
            <label className={style.fieldLabel} htmlFor={`word-${i}`}>{`Word #${i + 1}`}</label>
            <input id={`word-${i}`} className={style.input} type="text" autoComplete="off" autoCapitalize="none" spellCheck="false" value={answers[i] || ''} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} required />
          </React.Fragment>
        ))}
        <button type="submit" className={style.primary} disabled={busy}>{busy ? busyLabel : confirmLabel}</button>
        <button type="button" className={style.textButton} onClick={() => setStep('show')}>Show the phrase again</button>
      </form>
    </>
  );
};

export default PhraseSetup;
