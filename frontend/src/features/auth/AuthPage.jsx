import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { FaArrowLeftLong, FaRegCopy } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import style from './AuthPage.module.css';
import IconButton from '../../ui/IconButton';
import PasswordField from './PasswordField';
import { signedIn } from './sessionSlice';
import { signIn, signUp, recover } from './accountFlows';
import { generatePhrase, isValidPhrase, normalizePhrase } from '../../lib/crypto/phrase';

const pickThree = () => {
  const picks = new Set();
  while (picks.size < 3) picks.add(Math.floor(Math.random() * 24));
  return [...picks].sort((a, b) => a - b);
};

const SignIn = ({ onDone, setMode }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      onDone(await signIn({ username, password }));
    } catch (error) {
      toast.error(error.message);
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className={style.title}>Sign in</h1>
      <form className={style.form} onSubmit={submit}>
        <label className="sr-only" htmlFor="username">Username</label>
        <input id="username" className={style.input} type="text" placeholder="Username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <label className="sr-only" htmlFor="password">Password</label>
        <input id="password" className={style.input} type="password" placeholder="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" className={style.primary} disabled={busy}>{busy ? 'Unlocking your keys…' : 'Sign in'}</button>
      </form>
      <p className={style.switch}>
        <button type="button" onClick={() => setMode('recover')}>Forgot password?</button>
      </p>
      <p className={style.switch}>
        New here?
        {' '}
        <button type="button" onClick={() => setMode('signup')}>Create an account</button>
      </p>
    </>
  );
};

const SignUp = ({ onDone, setMode }) => {
  const [step, setStep] = useState('details');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [strong, setStrong] = useState(false);
  const [written, setWritten] = useState(false);
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const phrase = useMemo(() => generatePhrase(), []);
  const words = phrase.split(' ');
  const checks = useMemo(() => pickThree(), []);

  const details = (event) => {
    event.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    if (!strong) {
      toast.error('Choose a stronger password');
      return;
    }
    setStep('phrase');
  };

  const create = async (event) => {
    event.preventDefault();
    const wrong = checks.find((i) => (answers[i] || '').trim().toLowerCase() !== words[i]);
    if (wrong !== undefined) {
      toast.error(`Word #${wrong + 1} doesn't match. Check what you wrote down.`);
      return;
    }
    setBusy(true);
    try {
      onDone(await signUp({ username, password, phrase }));
    } catch (error) {
      toast.error(error.message);
      setBusy(false);
    }
  };

  if (step === 'phrase') {
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

  if (step === 'confirm') {
    return (
      <>
        <h1 className={style.title}>Confirm your phrase</h1>
        <p className={style.lead}>Enter these words from your recovery phrase.</p>
        <form className={style.form} onSubmit={create}>
          {checks.map((i) => (
            <React.Fragment key={i}>
              <label className={style.fieldLabel} htmlFor={`word-${i}`}>{`Word #${i + 1}`}</label>
              <input id={`word-${i}`} className={style.input} type="text" autoComplete="off" autoCapitalize="none" spellCheck="false" value={answers[i] || ''} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} required />
            </React.Fragment>
          ))}
          <button type="submit" className={style.primary} disabled={busy}>{busy ? 'Creating your keys…' : 'Create account'}</button>
          <button type="button" className={style.textButton} onClick={() => setStep('phrase')}>Show the phrase again</button>
        </form>
      </>
    );
  }

  return (
    <>
      <h1 className={style.title}>Create account</h1>
      <form className={style.form} onSubmit={details}>
        <label className="sr-only" htmlFor="username">Username</label>
        <input id="username" className={style.input} type="text" placeholder="Username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <PasswordField id="password" label="Password" value={password} onChange={setPassword} userInputs={[username, 'ghostchat']} onStrength={setStrong} />
        <label className="sr-only" htmlFor="confirm">Confirm password</label>
        <input id="confirm" className={style.input} type="password" placeholder="Confirm password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        <button type="submit" className={style.primary}>Continue</button>
      </form>
      <p className={style.switch}>
        Already have an account?
        {' '}
        <button type="button" onClick={() => setMode('signin')}>Sign in</button>
      </p>
    </>
  );
};

const Recover = ({ onDone, setMode }) => {
  const [username, setUsername] = useState('');
  const [phrase, setPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [strong, setStrong] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!isValidPhrase(phrase)) {
      toast.error("That isn't a valid recovery phrase. Check each word.");
      return;
    }
    if (!strong) {
      toast.error('Choose a stronger password');
      return;
    }
    setBusy(true);
    try {
      onDone(await recover({ username, phrase: normalizePhrase(phrase), newPassword: password }));
    } catch (error) {
      toast.error(error.message);
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className={style.title}>Recover account</h1>
      <p className={style.lead}>Your recovery phrase proves the account is yours. Then choose a new password.</p>
      <form className={style.form} onSubmit={submit}>
        <label className="sr-only" htmlFor="username">Username</label>
        <input id="username" className={style.input} type="text" placeholder="Username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <label className="sr-only" htmlFor="phrase">Recovery phrase</label>
        <textarea id="phrase" className={`${style.input} ${style.textarea}`} placeholder="Recovery phrase (24 words)" autoComplete="off" autoCapitalize="none" spellCheck="false" value={phrase} onChange={(e) => setPhrase(e.target.value)} required />
        <PasswordField id="password" label="New password" value={password} onChange={setPassword} userInputs={[username]} onStrength={setStrong} />
        <button type="submit" className={style.primary} disabled={busy}>{busy ? 'Recovering…' : 'Recover account'}</button>
      </form>
      <p className={style.switch}>
        <button type="button" onClick={() => setMode('signin')}>Back to sign in</button>
      </p>
    </>
  );
};

const VIEWS = { signin: SignIn, signup: SignUp, recover: Recover };

const AuthPage = () => {
  const [mode, setMode] = useState('signin');
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const View = VIEWS[mode];

  const onDone = (user) => {
    dispatch(signedIn(user));
    navigate('/chatpage');
  };

  return (
    <div className={style.page}>
      <IconButton icon={FaArrowLeftLong} label="Back to home" size={22} className={style.back} onClick={() => navigate('/')} />
      <main className={style.card}>
        <View key={mode} onDone={onDone} setMode={setMode} />
      </main>
      <p className={style.wordmark}>Ghost Chat</p>
    </div>
  );
};

export default AuthPage;
