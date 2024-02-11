import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowRightFromBracket, FaBars, FaXmark } from 'react-icons/fa6';
import style from '../assets/style/chat-page.module.css';
import socket from '../services/socket.service';
import Chat from '../components/chat.component';
import SideBar from '../components/sidebar.component';
import log from '../utils/logger.utils';

const ChatPage = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('none');
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is authenticated and retrieve user data
    const auth = window.localStorage.getItem('token');
    if (auth) {
      const token = JSON.parse(auth);
      delete token.token;
      setUser(token);

      // Initialize socket
      socket.initialize(token);
    } else {
      log.info('error');
    }
  }, []);

  // Handle logout
  const Logout = () => {
    window.localStorage.clear();
    socket.logout(user);
    navigate('/login-register');
  };

  // Handle clicking event on the menu bar
  const Click = () => (
    view === 'none' ? setView('block') : setView('none')
  );

  // Content to be displayed
  return (
    <div>
      <FaArrowRightFromBracket size={20} className={style.logout} onClick={Logout} />
      <div className={style.bar}>
        { view === 'none' && <FaBars className={style.menu} onClick={Click} /> }
        { view !== 'none' && <FaXmark className={style.menu} onClick={Click} />}
        <p>GhostChat</p>
      </div>
      <div className={style.chatpage}>
        <SideBar
          user={user}
          view={view}
          close={Click}
        />
        <div className={style.ChatContainer}>
          <Chat
            user={user}
          />
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
