import React, { useState } from 'react';
import { FaXmark } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Rooms from '../Services/Rooms';
import style from '../Assets/Style/JoinRoomForm.module.css';

const uuid = require('uuid');

const GetTime = () => {
  const date = new Date();
  const hour = date.getHours();
  let minute = date.getMinutes();

  if (minute <= 9) {
    minute = `0${minute}`;
  }

  return { hour, minute };
};

const JoinRoomForm = ({
  close, chats, setChats, socket, User,
}) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  const NameChange = (event) => (setName(event.target.value));
  const PasswordChange = (event) => (setPassword(event.target.value));

  const Submit = async (event) => {
    event.preventDefault();

    try {
      const response = await Rooms.JoinRoom(name, password);
      setChats(chats.concat({
        username: name,
        status: 'group',
        socket_id: response._id,
        UnreadMessages: false,
      }));

      const time = GetTime();
      socket.emit('join-room', name, response._id, (res) => {
        toast.success(`${res}`);
        socket.emit('message', {
          id: uuid.v4(),
          message: `${User.username} has joined the room`,
          from: { ...response, status: 'announcement' },
          to: response._id,
          time,
        }, response._id);
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
