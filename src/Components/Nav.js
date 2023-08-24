import React from 'react';
import { FaBars } from 'react-icons/fa';
import style from '../Assets/Style/Nav.module.css';

const Nav = () => (
  <nav className={style.nav}>
    <div>
      <FaBars className={style.icon} size={30} />
    </div>
  </nav>
);

export default Nav;
