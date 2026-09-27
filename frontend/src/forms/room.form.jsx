import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import panel from '../assets/style/panel.module.css';
import api from '../api';
import { contactAdded } from '../store/chat';
import { openConversation } from '../components/sidebar.component';

/** Creating and joining a room take the same fields; creating also asks to confirm the password. */
const RoomForm = ({ mode, close, back }) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const dispatch = useDispatch();
  const creating = mode === 'create';

  const submit = async (event) => {
    event.preventDefault();
    if (creating && password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    try {
      const { data: room } = await api.post(creating ? '/rooms' : '/rooms/join', { name, password });
      const contact = { id: room.id, name: room.name, kind: 'room' };
      dispatch(contactAdded(contact));
      openConversation(dispatch, { ...contact, key: `room:${room.id}` });
      toast.success(creating ? 'Room created' : 'Joined room');
      close();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <form className={panel.form} onSubmit={submit}>
      <label htmlFor="room-name">Room name</label>
      <input id="room-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      <label htmlFor="room-password">Password</label>
      <input id="room-password" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
      {creating && (
        <>
          <label htmlFor="room-confirm">Confirm password</label>
          <input id="room-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </>
      )}
      <div className={panel.actions}>
        <button type="button" className={panel.secondary} onClick={back}>Back</button>
        <button type="submit" className={panel.primary}>{creating ? 'Create' : 'Join'}</button>
      </div>
    </form>
  );
};

export default RoomForm;
