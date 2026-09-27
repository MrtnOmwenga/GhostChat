import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { FaArrowRightFromBracket, FaBars } from 'react-icons/fa6';
import CPstyle from './ChatPage.module.css';
import Chat from './Conversation';
import SideBar from './Sidebar';
import Toggable from './MenuPanel';
import IconButton from '../../ui/IconButton';
import api from '../../lib/api';
import { connect, disconnect } from '../../lib/socket';
import { signedIn, signedOut } from '../auth/sessionSlice';
import { chatReset, contactAdded } from './chatSlice';
import { loadKeys, forgetKeys } from '../../lib/keystore';
import UnlockPanel from '../auth/UnlockPanel';

export const signOut = async (dispatch, navigate) => {
  await api.post('/auth/logout').catch(() => {});
  await forgetKeys();
  disconnect();
  dispatch(chatReset());
  dispatch(signedOut());
  navigate('/login-register');
};

const ChatPage = () => {
  const user = useSelector((state) => state.session.user);
  const active = useSelector((state) => state.chat.active);
  const [menuOpen, setMenuOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [unlockedAt, setUnlockedAt] = useState(0);
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
        if (!(await loadKeys(me.id))) {
          setLocked(true);
          return;
        }
        setLocked(false);
        const [{ data: people }, { data: rooms }] = await Promise.all([
          api.get('/messages/conversations'),
          api.get('/rooms/mine'),
        ]);
        people.forEach((person) => dispatch(contactAdded({ id: person.id, name: person.username, kind: 'user' })));
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
  }, [dispatch, navigate, unlockedAt]);

  if (!user) return null;
  if (locked) {
    return <UnlockPanel user={user} onUnlocked={() => setUnlockedAt(Date.now())} onSignOut={() => signOut(dispatch, navigate)} />;
  }

  return (
    <div className={CPstyle.page}>
      <header className={CPstyle.bar}>
        <IconButton icon={FaBars} label="Menu" onClick={() => setMenuOpen(true)} />
        <p className={CPstyle.title}>GhostChat</p>
        <span className={CPstyle.me}>{user.username}</span>
        <IconButton icon={FaArrowRightFromBracket} label="Sign out" onClick={() => signOut(dispatch, navigate)} />
      </header>
      {/* On narrow screens only one pane shows: the list, or the open conversation. */}
      <div className={`${CPstyle.panes} ${active ? CPstyle.conversationOpen : ''}`}>
        <SideBar />
        <Chat user={user} />
      </div>
      {menuOpen && <Toggable close={() => setMenuOpen(false)} />}
    </div>
  );
};

export default ChatPage;
