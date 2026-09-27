import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaBars, FaXmark } from 'react-icons/fa6';
import IconButton from '../../ui/IconButton';
import NavStyle from './Nav.module.css';

const Nav = () => {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className={NavStyle.nav}>
      <a href="#top" className={NavStyle.brand} onClick={close}>GhostChat</a>
      <IconButton
        icon={open ? FaXmark : FaBars}
        label={open ? 'Close menu' : 'Open menu'}
        size={22}
        className={NavStyle.toggle}
        aria-expanded={open}
        aria-controls="site-menu"
        onClick={() => setOpen(!open)}
      />
      <nav id="site-menu" className={`${NavStyle.menu} ${open ? NavStyle.open : ''}`}>
        <a href="#features" onClick={close}>Features</a>
        <a href="#faq" onClick={close}>FAQ</a>
        <Link to="/login-register" className={NavStyle.cta}>Start messaging</Link>
      </nav>
    </header>
  );
};

export default Nav;
