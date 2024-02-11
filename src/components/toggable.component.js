import React, { useState } from 'react';
import MainMenu from './main-menu.component';
import CreateRoomForm from '../forms/create-room.form';
import JoinRoomForm from '../forms/join-room.form';

const Toggable = ({ close, user }) => {
  const [view, setView] = useState('main-menu');
  const views = {
    'main-menu': MainMenu,
    'create-room': CreateRoomForm,
    'join-room': JoinRoomForm,
  };

  const CurrentView = views[view];

  return (
    <div>
      <CurrentView
        ChangeView={setView}
        close={close}
        user={user}
      />
    </div>
  );
};

export default Toggable;
