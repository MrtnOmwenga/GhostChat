import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBars } from 'react-icons/fa';
import { FaXmark } from 'react-icons/fa6';
import NavStyle from '../assets/style/nav.module.css';

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
    <nav className={NavStyle.nav}>
      <div>
        { view === 'none' && <FaBars className={NavStyle.icon} size={25} onClick={Click} /> }
        { view !== 'none' && <FaXmark className={NavStyle.icon} size={30} onClick={Click} />}
      </div>
      <div className={NavStyle.menu} style={{ display: view }}>
        <div className={NavStyle.center_menu}>
          <button type="button">Home</button>
          <button type="button">About</button>
          <button type="button">FAQS</button>
        </div>
        <div className={NavStyle.right_menu}>
          <button type="button" onClick={LoginRegister}>Start Messaging</button>
        </div>
      </div>
    </nav>
  );
};

export default Nav;
