import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { FaXmark } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import api from '../api';
import { contactAdded } from '../store/chat';
import { openConversation } from '../components/sidebar.component';
import JRstyle from '../assets/form-styles/join-room.module.css';

const JoinRoomForm = ({ close }) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useDispatch();

  const submit = async (event) => {
    event.preventDefault();
    try {
      const { data: room } = await api.post('/rooms/join', { name, password });
      const contact = { id: room.id, name: room.name, kind: 'room' };
      dispatch(contactAdded(contact));
      openConversation(dispatch, { ...contact, key: `room:${room.id}` });
      toast.success('Joined room');
      close();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className={JRstyle.joinroom}>
      <FaXmark className={JRstyle.close} size={20} onClick={close} />
      <h3>Join Room</h3>
      <form onSubmit={submit}>
        <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input type="password" placeholder="Password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit">Submit</button>
      </form>
    </div>
  );
};

export default JoinRoomForm;
