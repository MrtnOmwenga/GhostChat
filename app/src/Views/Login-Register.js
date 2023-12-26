import { React, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeftLong } from 'react-icons/fa6';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import style from '../Assets/Style/Login-Register.module.css';
import LoginService from '../Services/Login';
import RegisterService from '../Services/Register';
import Token from '../Services/Token';

// const log = require('../Utils/logger');

/**
 * The above function is a React component that handles the login and registration
 * functionality for a chat application.
 * @returns The LoginRegister component is returning a JSX element, which consists
 * of a div containing two containers for login and registration forms, a back button,
 *  a footer, and a ToastContainer component.
 */
const LoginRegister = () => {
  const [state, setState] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pwd, setPwd] = useState('');
  const navigate = useNavigate();

  /**
   * The function `ChangeState` toggles between the states 'login' and 'register'.
   */
  const ChangeState = () => (state === 'login' ? setState('register') : setState('login'));

  /**
   * The Back function navigates to the previous page.
   */
  const Back = () => {
    navigate('/');
  };

  /**
   * The `UsernameChange` function updates the username based on the value of an event target.
   * @param event - The event parameter is an object that represents the event that triggered the
   * function. In this case, it is likely an event object that is generated when a user changes the
   * value of an input field.
   */
  const UsernameChange = (event) => {
    setUsername(event.target.value);
  };

  /**
   * The PasswordChange function updates the password value based on the input event.
   * @param event - The event parameter is an object that represents the event that triggered the
   * function. In this case, it is likely an event object that is generated when a user
   * interacts with an input field, such as typing or pasting text into it.
   */
  const PasswordChange = (event) => {
    setPassword(event.target.value);
  };

  /**
   * The PwdChange function updates the value of a password variable based on the value of an event
   * target.
   * @param event - The event parameter is an object that represents the event that triggered the
   * function. In this case, it is likely an event object related to a user input event, such as a
   * change event on an input field.
   */
  const PwdChange = (event) => {
    setPwd(event.target.value);
  };

  /**
   * The HandleSubmit function is used to handle form submissions for login and registration,
   * including error handling and navigation.
   * @param event - The event parameter is an object that represents the event that triggered the
   * function. In this case, it is used to prevent the default behavior of a form submission,
   * which is to refresh the page.
   */
  const HandleSubmit = async (event) => {
    event.preventDefault();
    if (state === 'login') {
      /* The code block is handling the login functionality. It tries to make a request to the
      `LoginService.Login` function with the provided `username` and `password`. If the login is
      successful, it stores the token in the local storage, sets the token using the
      `Token.SetToken` function, and navigates to the '/chatpage' route. If there is an error during
      the login process, it displays the error message using the `toast.error` function. */
      try {
        const response = await LoginService.Login({ username, password });
        window.localStorage.setItem('token', JSON.stringify(response));
        Token.SetToken(response.token);
        navigate('/chatpage');
      } catch (error) {
        toast.error(`${error}`);
      }
    } else if (state === 'register') {
      /* The code block is handling the registration functionality. It checks if the username,
      password, and pwd (confirm password) fields are not empty. If they are not empty, it checks if
      the password and pwd values match. If they match, it tries to make a request to the
      `RegisterService.Register` function with the provided username and password. If the
      registration is successful, it sets the token using the `Token.SetToken` function and
      navigates to the '/chatpage' route. If there is an error during the registration process, it
      displays the error message using the `toast.error` function. If any of the fields are empty,
      it displays an error message asking the user to fill all fields. If the password and pwd
      values do not match, it displays an error message stating that the passwords don't match. */
      if (username !== '' && password !== '' && pwd !== '') {
        if (password === pwd) {
          try {
            const response = await RegisterService.Register({ username, password });
            Token.SetToken(response.token);
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

  /* The `return` statement in the code is returning a JSX element, which represents the
  structure and content of the component's rendered output. */
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
