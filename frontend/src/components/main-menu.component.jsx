import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import panel from '../assets/style/panel.module.css';
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
    <ul className={panel.menu}>
      <li><button type="button" onClick={() => ChangeView('create')}>Create a room</button></li>
      <li><button type="button" onClick={() => ChangeView('join')}>Join a room</button></li>
      <li><button type="button" onClick={showMyRooms}>My rooms</button></li>
      <li><button type="button" className={panel.danger} onClick={deleteAccount}>Delete account</button></li>
    </ul>
  );
};

export default MainMenu;
