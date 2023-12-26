import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowRightFromBracket, FaBars, FaXmark } from 'react-icons/fa6';
import style from '../Assets/Style/ChatPage.module.css';
import Socket from '../Services/Socket';
import Chat from '../Components/Chat';
import SideBar from '../Components/SideBar';
import log from '../Utils/logger';

/**
 * The ChatPage component is a JavaScript function that renders a chat page with a
 * menu bar, side bar, and chat container.
 * @returns The ChatPage component is returning a JSX element.
 */
const ChatPage = () => {
  const [socket, setSocket] = useState(null);
  const [Recipient, setRecipient] = useState(null);
  const [user, setUser] = useState(null);
  const [view, setView] = useState('none');
  const navigate = useNavigate();

  /* The `useEffect` hook in this code is used to perform side effects in a functional component. In
  this case, it is used to check if the user is authenticated and retrieve user data. */
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
  /**
   * The `Logout` function clears the local storage, emits a 'logout' event to the socket
   * server with the user's ID, disconnects the socket, and navigates to the
   * '/login-register' page.
   */
  const Logout = () => {
    window.localStorage.clear();
    socket?.emit('logout', user.id);
    socket?.disconnect();
    navigate('/login-register');
  };

  // Handle clicking event on the menu bar
  /**
   * The Click function toggles the view between 'none' and 'block'.
   */
  const Click = () => (
    view === 'none' ? setView('block') : setView('none')
  );

  // Content to be displayed
  /* The `return` statement in the code is returning a JSX element. JSX is a syntax extension for
  JavaScript that allows you to write HTML-like code in your JavaScript files. */
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
