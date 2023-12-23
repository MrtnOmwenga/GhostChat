import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowRightFromBracket, FaBars, FaXmark } from 'react-icons/fa6';
import style from '../Assets/Style/ChatPage.module.css';
import Socket from '../Services/Socket';
import Chat from '../Components/Chat';
import SideBar from '../Components/SideBar';
import log from '../Utils/logger';

const ChatPage = () => {
  const [socket, setSocket] = useState(null);
  const [Recipient, setRecipient] = useState(null);
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
      const SocketObject = Socket(token.id, token.username);
      setSocket(SocketObject);
    } else {
      log.info('error');
    }
  }, []);

  // Handle logout
  const Logout = () => {
    window.localStorage.clear();
    socket?.emit('logout', user.id);
    socket?.disconnect();
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
          socket={socket}
          ChangeUser={setRecipient}
          User={user}
          view={view}
          close={Click}
        />
        <div className={style.ChatContainer}>
          <Chat
            socket={socket}
            Recipient={Recipient}
            User={user}
          />
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
