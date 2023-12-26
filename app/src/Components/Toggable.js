import React, { useState } from 'react';
import MainMenu from './main-menu';
import CreateRoomForm from './CreateRoomForm';
import JoinRoomForm from './JoinRoomForm';

const Toggable = ({
  socket, close, chats, setChats, User,
}) => {
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
        chats={chats}
        setChats={setChats}
        socket={socket}
        User={User}
      />
    </div>
  );
};

export default Toggable;
