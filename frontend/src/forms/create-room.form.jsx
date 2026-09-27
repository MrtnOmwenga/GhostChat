import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { FaXmark } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import api from '../api';
import { contactAdded } from '../store/chat';
import { openConversation } from '../components/sidebar.component';
import CRstyle from '../assets/form-styles/create-room.module.css';

const CreateRoomForm = ({ close }) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const dispatch = useDispatch();

  const submit = async (event) => {
    event.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    try {
      const { data: room } = await api.post('/rooms', { name, password });
      const contact = { id: room.id, name: room.name, kind: 'room' };
      dispatch(contactAdded(contact));
      openConversation(dispatch, { ...contact, key: `room:${room.id}` });
      toast.success('Room created');
      close();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className={CRstyle.createroom}>
      <FaXmark className={CRstyle.close} size={20} onClick={close} />
      <h3>Create Room</h3>
      <form onSubmit={submit}>
        <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input type="password" placeholder="Password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <input type="password" placeholder="Confirm Password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        <button type="submit">Submit</button>
      </form>
    </div>
  );
};

export default CreateRoomForm;
