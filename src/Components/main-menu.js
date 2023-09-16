import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaXmark } from 'react-icons/fa6';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import style from '../Assets/Style/main-menu.module.css';
import Register from '../Services/Register';
import Rooms from '../Services/Rooms';
// import log from '../Utils/logger';

const MainMenu = ({
  ChangeView, close, chats, setChats, socket, User,
}) => {
  const navigate = useNavigate();

  const CreateRoom = () => {
    ChangeView('create-room');
  };

  const JoinRoom = () => {
    ChangeView('join-room');
  };

  const MyRoom = async () => {
    const response = await Rooms.MyRooms(User.id);

    if (response.length === 0) {
      toast.error('You have no active rooms');
    }

    const List = [];
    response.forEach((room) => {
      List.push({
        username: room.name,
        status: 'group',
        socket_id: room._id,
        UnreadMessages: false,
      });

      socket.emit('join-room', room.name, room._id, (res) => {
        toast.success(`${res}`);
      });
    });
    setChats(chats.concat(List));
    close();
  };

  const DeleteAccount = async () => {
    try {
      await Register.DeleteAccount(User.id);
      socket.emit('logout', User.id);
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
