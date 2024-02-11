import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaXmark } from 'react-icons/fa6';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useDispatch } from 'react-redux';
import { AddContact } from '../services/message.service';
import socket from '../services/socket.service';
import style from '../assets/style/main-menu.module.css';
import Register from '../services/register.service';
import Rooms from '../services/rooms.service';

const MainMenu = ({
  ChangeView, close, user,
}) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const CreateRoom = () => {
    ChangeView('create-room');
  };

  const JoinRoom = () => {
    ChangeView('join-room');
  };

  const MyRoom = async () => {
    const response = await Rooms.MyRooms(user.id);

    if (response.length === 0) {
      toast.error('You have no active rooms');
    }

    response.forEach((room) => {
      const RoomObject = {
        username: room.name,
        status: 'group',
        socket_id: room.id,
        UnreadMessages: false,
      };

      socket.join_room(room.name, user.username, RoomObject, (res) => {
        toast.success(`${res}`);
      });

      dispatch(AddContact(room));
    });
    close();
  };

  const DeleteAccount = async () => {
    try {
      await Register.DeleteAccount(user.id);
      socket.logout(user.id);
      navigate('/login-register');
    } catch (error) {
      toast.error(`${error}`);
    }
  };

  return (
    <div className={style.mainmenu}>
      <FaXmark className={style.close} size={20} onClick={close} />
      <ul>
        <li>
          <button type="button" onClick={CreateRoom}>Create Room</button>
        </li>
        <li>
          <button type="button" onClick={JoinRoom}>Join Room</button>
        </li>
        <li>
          <button type="button" onClick={MyRoom}>My Rooms</button>
        </li>
        <li>
          <button type="button" onClick={DeleteAccount}>Delete Account</button>
        </li>
      </ul>
      <ToastContainer />
    </div>
  );
};

export default MainMenu;
