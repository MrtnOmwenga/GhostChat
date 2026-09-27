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
import {
  startMessaging, stopMessaging, loadConversations, receiveLive, onRoomChanged, acceptInvite, receiveReceipt, markRead,
} from '../../lib/messaging';
import { toast } from 'react-toastify';
import { signedIn, signedOut } from '../auth/sessionSlice';
import { chatReset } from './chatSlice';
import { loadKeys, forgetKeys } from '../../lib/keystore';
import UnlockPanel from '../auth/UnlockPanel';

export const signOut = async (dispatch, navigate) => {
  await api.post('/auth/logout').catch(() => {});
  await forgetKeys();
  disconnect();
  stopMessaging();
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
        startMessaging(me);
        await loadConversations();
        connect({ onMessage: receiveLive, onRoom: onRoomChanged, onReceipt: receiveReceipt });
        // An invite link opened before signing in is picked up here (see JoinPage).
        const pending = sessionStorage.getItem('pendingInvite');
        if (pending) {
          sessionStorage.removeItem('pendingInvite');
          const { id, secret } = JSON.parse(pending);
          await acceptInvite(id, secret).catch((error) => toast.error(error.message));
        }
      } catch {
        if (!cancelled) navigate('/login-register');
      }
    })();
    return () => {
      cancelled = true;
      disconnect();
    };
  }, [dispatch, navigate, unlockedAt]);

  // Coming back to the tab counts as reading the open conversation.
  useEffect(() => {
    const onVisible = () => { if (active && document.visibilityState === 'visible') markRead(active); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [active]);

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
