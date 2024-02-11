import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBars } from 'react-icons/fa';
import { FaXmark } from 'react-icons/fa6';
import style from '../assets/style/nav.module.css';

const Nav = () => {
  const [view, setView] = useState('none');
  const navigate = useNavigate();

  const Click = () => (
    view === 'none' ? setView('block') : setView('none')
  );

  const LoginRegister = () => {
    navigate('/login-register');
  };

  return (
    <nav className={style.nav}>
      <div>
        { view === 'none' && <FaBars className={style.icon} size={25} onClick={Click} /> }
        { view !== 'none' && <FaXmark className={style.icon} size={30} onClick={Click} />}
      </div>
      <div className={style.menu} style={{ display: view }}>
        <div className={style.center_menu}>
          <button type="button">Home</button>
          <button type="button">About</button>
          <button type="button">FAQS</button>
        </div>
        <div className={style.right_menu}>
          <button type="button" onClick={LoginRegister}>Start Messaging</button>
        </div>
      </div>
    </nav>
  );
};

export default Nav;
