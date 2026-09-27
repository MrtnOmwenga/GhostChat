import React, { useEffect, useState } from 'react';
import { MIN_PASSWORD_SCORE, passwordStrength } from '../../lib/crypto/password';
import style from './AuthPage.module.css';

const LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];

/**
 * A new-password input with a zxcvbn strength meter. Reports `strongEnough` so forms can block
 * submission: the server never sees the password, so this is the only place strength is checked.
 */
const PasswordField = ({
  id, label, value, onChange, userInputs = [], onStrength,
}) => {
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setResult(null);
      onStrength?.(false);
      return undefined;
    }
    const timer = setTimeout(async () => {
      const strength = await passwordStrength(value, userInputs);
      if (cancelled) return;
      setResult(strength);
      onStrength?.(strength.score >= MIN_PASSWORD_SCORE);
    }, 150);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, userInputs.join('|')]);

  const hint = result && result.score < MIN_PASSWORD_SCORE
    ? (result.warning || result.suggestions[0] || 'Add more words or characters')
    : 'Tip: a few unrelated words make a strong, memorable password.';

  return (
    <div className={style.passwordField}>
      <label className="sr-only" htmlFor={id}>{label}</label>
      <input id={id} className={style.input} type="password" placeholder={label} autoComplete="new-password" value={value} onChange={(e) => onChange(e.target.value)} required />
      <div className={style.meter} aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={result && i <= result.score ? style[`level${result.score}`] : ''} />
        ))}
      </div>
      <p className={style.hint} aria-live="polite">
        {result && <strong>{LABELS[result.score]}. </strong>}
        {hint}
      </p>
    </div>
  );
};

export default PasswordField;
