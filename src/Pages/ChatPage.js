import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaArrowRightFromBracket } from 'react-icons/fa6';
import style from '../Assets/Style/ChatPage.module.css';
import Socket from '../Services/Socket';
import Chat from '../Components/Chat';
import SideBar from '../Components/SideBar';
import log from '../Utils/logger';

const ChatPage = () => {
  const [socket, setSocket] = useState(null);
  const [CurrentUser, setCurrentUser] = useState(null);
  const location = useLocation();
  const token = location.state;
  log.info(token);
  const navigate = useNavigate();

  useEffect(() => {
    const SocketObject = Socket(token.id, token.username);
    setSocket(SocketObject);
    log.info('Logged in');
  }, []);

  const display = () => {
    if (CurrentUser === null) {
      return <p className={style.select_text}>Search and select a user to start messaging</p>;
    }
    return <Chat socket={socket} CurrentUser={CurrentUser} />;
  };

  const Logout = () => {
    socket.emit('logout', token.id);
    navigate('/login-register');
    log.info('Logged out');
  };

  return (
    <div>
      <FaArrowRightFromBracket size={20} className={style.logout} onClick={Logout} />
      <div className={style.bar}>
        <p>GhostChat</p>
      </div>
      <div className={style.chatpage}>
        <SideBar socket={socket} ChangeUser={setCurrentUser} token={token} />
        {display()}
      </div>
    </div>
  );
};

export default ChatPage;
