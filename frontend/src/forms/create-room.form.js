import React, { useState } from 'react';
import { FaXmark } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import { useDispatch } from 'react-redux'; // Import useSelector from react-redux
import 'react-toastify/dist/ReactToastify.css';
import { AddContact } from '../services/message.service';
import Rooms from '../services/rooms.service';
import socket from '../services/socket.service';
import style from '../assets/form-styles/create-room.module.css';
import log from '../utils/logger.utils';

const CreateRoomForm = ({ close, user }) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const dispatch = useDispatch();
  const NameChange = (event) => (setName(event.target.value));
  const PasswordChange = (event) => (setPassword(event.target.value));
  const ConfirmChange = (event) => (setConfirm(event.target.value));

  const Submit = async (event) => {
    event.preventDefault();

    if (password === confirm) {
      try {
        const response = await Rooms.CreateRoom(name, password);
        dispatch(AddContact({
          username: name,
          status: 'group',
          socket_id: response.id,
          UnreadMessages: false,
        }));

        socket.join_room(user.username, response, (res) => {
          toast.success(`${res}`);
        });
        toast.success('Created room');

        close();
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
