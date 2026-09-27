import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { FaArrowLeftLong } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import style from './AuthPage.module.css';
import IconButton from '../../ui/IconButton';
import api from '../../lib/api';
import { signedIn } from './sessionSlice';

const LoginRegister = () => {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isLogin = mode === 'login';

  const submit = async (event) => {
    event.preventDefault();
    if (!isLogin && password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post(isLogin ? '/auth/login' : '/auth/register', { username, password });
      dispatch(signedIn(data));
      navigate('/chatpage');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={style.page}>
      <IconButton icon={FaArrowLeftLong} label="Back to home" size={22} className={style.back} onClick={() => navigate('/')} />
      <main className={style.card}>
        <h1 className={style.title}>{isLogin ? 'Sign in' : 'Create account'}</h1>
        <form className={style.form} onSubmit={submit}>
          <label className="sr-only" htmlFor="username">Username</label>
          <input id="username" className={style.input} type="text" placeholder="Username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <label className="sr-only" htmlFor="password">Password</label>
          <input id="password" className={style.input} type="password" placeholder="Password (8+ characters)" autoComplete={isLogin ? 'current-password' : 'new-password'} minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          {!isLogin && (
            <>
              <label className="sr-only" htmlFor="confirm">Confirm password</label>
              <input id="confirm" className={style.input} type="password" placeholder="Confirm password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </>
          )}
          <button type="submit" className={style.primary} disabled={busy}>{isLogin ? 'Sign in' : 'Sign up'}</button>
        </form>
        <p className={style.switch}>
          {isLogin ? 'New here?' : 'Already have an account?'}
          {' '}
          <button type="button" onClick={() => setMode(isLogin ? 'register' : 'login')}>
            {isLogin ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </main>
      <p className={style.wordmark}>Ghost Chat</p>
    </div>
  );
};

export default LoginRegister;
