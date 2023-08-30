import { React, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeftLong } from 'react-icons/fa6';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import style from '../Assets/Style/Login-Register.module.css';
import LoginService from '../Services/Login';
import RegisterService from '../Services/Register';

// const log = require('../Utils/logger');

const LoginRegister = () => {
  const [state, setState] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pwd, setPwd] = useState('');
  const navigate = useNavigate();

  const ChangeState = () => (state === 'login' ? setState('register') : setState('login'));

  const Back = () => {
    navigate('/');
  };

  const UsernameChange = (event) => {
    setUsername(event.target.value);
  };

  const PasswordChange = (event) => {
    setPassword(event.target.value);
  };

  const PwdChange = (event) => {
    setPwd(event.target.value);
  };

  const HandleSubmit = async (event) => {
    event.preventDefault();
    if (state === 'login') {
      try {
        const response = await LoginService.Login({ username, password });
        navigate('/chatpage', { state: { ...response } });
      } catch (error) {
        toast.error(`${error}`);
      }
    } else if (state === 'register') {
      if (username !== '' && password !== '' && pwd !== '') {
        if (password === pwd) {
          try {
            const response = await RegisterService.Register({ username, password });
            navigate('/chatpage', { state: { ...response } });
          } catch (error) {
            toast.error(`${error}`);
          }
        } else {
          toast.error("Passwords don't match");
        }
      } else {
        toast.error('Please fill all fields');
      }
    }
  };

  return (
    <div>
      <FaArrowLeftLong className={style.back} size={25} onClick={Back} />
      <div className={style.login_register}>
        <div className={`${style.container} ${style.a_container}`} id="a-container" style={{ display: state === 'login' ? 'none' : null }}>
          <form className={style.form} id="a-form" method="post" onSubmit={HandleSubmit}>
            <h2 className={`${style.form_title} ${style.title}`}>Create Account</h2>
            <input className={style.form__input} type="text" placeholder="Username" name="username" onChange={UsernameChange} />
            <input className={style.form__input} type="password" placeholder="Password" name="password" onChange={PasswordChange} />
            <input className={style.form__input} type="password" placeholder="Confirm Password" name="password" onChange={PwdChange} />
            <div>
              <button type="button" className={`${style.switch__button} ${style.button} ${style.switch_btn}`} onClick={ChangeState}>SIGN IN</button>
              <button className={`${style.form__button} ${style.button} ${style.switch_btn}`} type="submit" name="signup">SIGN UP</button>
            </div>
          </form>
        </div>
        <div className={`${style.container} ${style.b_container}`} id="b-container" style={{ display: state === 'register' ? 'none' : null }}>
          <form className={style.form} id="b-form" method="post" action="index.html" onSubmit={HandleSubmit}>
            <h2 className={`${style.form_title} ${style.title}`}>Sign in</h2>
            <input className={style.form__input} type="text" placeholder="Username" name="username" onChange={UsernameChange} />
            <input className={style.form__input} type="password" placeholder="Password" name="password" onChange={PasswordChange} />
            <a className={style.form__link} href="/">Forgot your password?</a>
            <div>
              <button type="button" className={`${style.switch__button} ${style.button} ${style.switch_btn}`} onClick={ChangeState}>SIGN UP</button>
              <button type="submit" className={`${style.form__button} ${style.button} ${style.switch_btn}`} name="signin">SIGN IN</button>
            </div>
          </form>
        </div>
      </div>
      <div className={style.footer}>
        <h2>Ghost Chat</h2>
      </div>
      <ToastContainer />
    </div>
  );
};

export default LoginRegister;
