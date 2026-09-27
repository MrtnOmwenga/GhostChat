import React, { useEffect, useState } from 'react';
import { FaXmark } from 'react-icons/fa6';
import MainMenu from './main-menu.component';
import RoomForm from '../forms/room.form';
import IconButton from './icon-button.component';
import panel from '../assets/style/panel.module.css';

const TITLES = { menu: 'Menu', create: 'Create a room', join: 'Join a room' };

/** The chat menu as a modal panel: the main menu, or one of the room forms. */
const Toggable = ({ close }) => {
  const [view, setView] = useState('menu');

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <div className={panel.backdrop} onClick={close} role="presentation">
      <div className={panel.panel} role="dialog" aria-modal="true" aria-labelledby="panel-title" onClick={(e) => e.stopPropagation()}>
        <div className={panel.header}>
          <h2 id="panel-title">{TITLES[view]}</h2>
          <IconButton icon={FaXmark} label="Close" onClick={close} />
        </div>
        {view === 'menu' && <MainMenu ChangeView={setView} close={close} />}
        {view === 'create' && <RoomForm mode="create" close={close} back={() => setView('menu')} />}
        {view === 'join' && <RoomForm mode="join" close={close} back={() => setView('menu')} />}
      </div>
    </div>
  );
};

export default Toggable;
