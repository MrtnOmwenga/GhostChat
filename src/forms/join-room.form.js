import React, { useState } from 'react';
import { FaXmark } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import { useDispatch } from 'react-redux';
import 'react-toastify/dist/ReactToastify.css';
import { AddContact } from '../services/message.service';
import socket from '../services/socket.service';
import Rooms from '../services/rooms.service';
import style from '../assets/form-styles/join-room.module.css';

const JoinRoomForm = ({ close, user }) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  const dispatch = useDispatch();
  const NameChange = (event) => (setName(event.target.value));
  const PasswordChange = (event) => (setPassword(event.target.value));

  const Submit = async (event) => {
    event.preventDefault();

    try {
      const response = await Rooms.JoinRoom(name, password);
      const RoomObject = {
        username: response.name,
        status: 'group',
        id: response.id,
        socket_id: response.id,
        UnreadMessages: false,
      };

      dispatch(AddContact(RoomObject));
      socket.join_room(user.username, RoomObject, (res) => {
        toast.success(`${res}`);
      });
      close();
    } catch (exception) {
      toast.error(`${exception}`);
    }
  };

  return (
    <div className={style.joinroom}>
      <FaXmark className={style.close} size={20} onClick={close} />
      <form onSubmit={Submit}>
        <input type="text" placeholder="Name" value={name} onChange={NameChange} />
        <input type="password" placeholder="Password" value={password} onChange={PasswordChange} />
        <button type="submit">Join Room</button>
      </form>
    </div>
  );
};

export default JoinRoomForm;
