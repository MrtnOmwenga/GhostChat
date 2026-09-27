import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { FaXmark } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import MainStyle from '../assets/style/main-menu.module.css';
import api from '../api';
import { contactAdded } from '../store/chat';
import { signOut } from '../views/chat-page';

const MainMenu = ({ ChangeView, close }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const showMyRooms = async () => {
    try {
      const { data: rooms } = await api.get('/rooms/mine');
      if (rooms.length === 0) toast.info('You have no rooms yet');
      rooms.forEach((room) => dispatch(contactAdded({ id: room.id, name: room.name, kind: 'room' })));
      close();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const deleteAccount = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Delete your account? This cannot be undone.')) return;
    try {
      await api.delete('/users/me');
      await signOut(dispatch, navigate);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className={MainStyle.mainmenu}>
      <FaXmark className={MainStyle.close} size={20} onClick={close} />
      <ul>
        <li><button type="button" onClick={() => ChangeView('create-room')}>Create Room</button></li>
        <li><button type="button" onClick={() => ChangeView('join-room')}>Join Room</button></li>
        <li><button type="button" onClick={showMyRooms}>My Rooms</button></li>
        <li><button type="button" onClick={deleteAccount}>Delete Account</button></li>
      </ul>
    </div>
  );
};

export default MainMenu;
