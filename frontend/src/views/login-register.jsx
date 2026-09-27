import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { FaArrowLeftLong } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import style from '../assets/style/login-register.module.css';
import api from '../api';
import { signedIn } from '../store/session';

const LoginRegister = () => {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const submit = async (event) => {
    event.preventDefault();
    if (mode === 'register' && password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    try {
      const { data } = await api.post(mode === 'login' ? '/auth/login' : '/auth/register', { username, password });
      dispatch(signedIn(data));
      navigate('/chatpage');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const toggle = () => setMode(mode === 'login' ? 'register' : 'login');

  return (
    <div>
      <FaArrowLeftLong className={style.back} size={25} onClick={() => navigate('/')} />
      <div className={style.login_register}>
        <div className={style.container}>
          <form className={style.form} onSubmit={submit}>
            <h2 className={`${style.form_title} ${style.title}`}>{mode === 'login' ? 'Sign in' : 'Create Account'}</h2>
            <input className={style.form__input} type="text" placeholder="Username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            <input className={style.form__input} type="password" placeholder="Password (8+ characters)" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
            {mode === 'register' && (
              <input className={style.form__input} type="password" placeholder="Confirm Password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            )}
            <div>
              <button type="button" className={`${style.switch__button} ${style.button} ${style.switch_btn}`} onClick={toggle}>
                {mode === 'login' ? 'SIGN UP' : 'SIGN IN'}
              </button>
              <button type="submit" className={`${style.form__button} ${style.button} ${style.switch_btn}`}>
                {mode === 'login' ? 'SIGN IN' : 'SIGN UP'}
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className={style.footer}>
        <h2>Ghost Chat</h2>
      </div>
    </div>
  );
};

export default LoginRegister;
