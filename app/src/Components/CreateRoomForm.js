import React, { useState } from 'react';
import { FaXmark } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Rooms from '../Services/Rooms';
import style from '../Assets/Style/CreateRoomForm.module.css';
import log from '../Utils/logger';

const CreateRoomForm = ({
  close, chats, setChats, socket,
}) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const NameChange = (event) => (setName(event.target.value));
  const PasswordChange = (event) => (setPassword(event.target.value));
  const ConfirmChange = (event) => (setConfirm(event.target.value));

  const Submit = async (event) => {
    event.preventDefault();

    if (password === confirm) {
      try {
        const response = await Rooms.CreateRoom(name, password);
        setChats(chats.concat({
          username: name,
          status: 'group',
          socket_id: response._id,
          UnreadMessages: false,
        }));

        socket.emit('join-room', name, response._id, (res) => {
          toast.success(`${res}`);
        });
        close();
        toast.success('Created room');
      } catch (exception) {
        toast.error(`${exception}`);
      }
      log.info('Submitted');
    } else {
      toast.error('Passwords dont match');
    }
  };

  return (
    <div className={style.createroom}>
      <FaXmark className={style.close} size={20} onClick={close} />
      <form onSubmit={Submit}>
        <input type="text" placeholder="Name" value={name} onChange={NameChange} />
        <input type="password" placeholder="Password" value={password} onChange={PasswordChange} />
        <input type="password" placeholder="Confirm Password" value={confirm} onChange={ConfirmChange} />
        <button type="submit">Create Room</button>
      </form>
    </div>
  );
};

export default CreateRoomForm;
