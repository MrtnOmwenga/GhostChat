import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { FaArrowRightFromBracket, FaBars, FaXmark } from 'react-icons/fa6';
import CPstyle from '../assets/style/chat-page.module.css';
import Chat from '../components/chat.component';
import SideBar from '../components/sidebar.component';
import api from '../api';
import { connect, disconnect } from '../socket';
import { signedIn, signedOut } from '../store/session';
import { chatReset, contactAdded } from '../store/chat';

export const signOut = async (dispatch, navigate) => {
  await api.post('/auth/logout').catch(() => {});
  disconnect();
  dispatch(chatReset());
  dispatch(signedOut());
  navigate('/login-register');
};

const ChatPage = () => {
  const user = useSelector((state) => state.session.user);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // The session is the httpOnly cookie; /auth/me tells us whether it's still valid (for example
  // after a page reload) and who it belongs to.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: me } = await api.get('/auth/me');
        if (cancelled) return;
        dispatch(signedIn(me));
        const { data: rooms } = await api.get('/rooms/mine');
        rooms.forEach((room) => dispatch(contactAdded({ id: room.id, name: room.name, kind: 'room' })));
        connect();
      } catch {
        if (!cancelled) navigate('/login-register');
      }
    })();
    return () => {
      cancelled = true;
      disconnect();
    };
  }, [dispatch, navigate]);

  if (!user) return null;

  return (
    <div>
      <FaArrowRightFromBracket size={20} className={CPstyle.logout} onClick={() => signOut(dispatch, navigate)} />
      <div className={CPstyle.bar}>
        {menuOpen
          ? <FaXmark className={CPstyle.menu} onClick={() => setMenuOpen(false)} />
          : <FaBars className={CPstyle.menu} onClick={() => setMenuOpen(true)} />}
        <p>GhostChat</p>
      </div>
      <div className={CPstyle.chatpage}>
        <SideBar user={user} menuOpen={menuOpen} closeMenu={() => setMenuOpen(false)} />
        <div className={CPstyle.ChatContainer}>
          <Chat user={user} />
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
