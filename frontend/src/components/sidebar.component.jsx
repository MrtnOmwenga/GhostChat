import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaSistrix, FaCircleUser, FaUsers } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import SBstyle from '../assets/style/sidebar.module.css';
import ToggableMenu from './toggable.component';
import api from '../api';
import { requestPresence } from '../socket';
import { contactAdded, conversationOpened, historyLoaded } from '../store/chat';

export const openConversation = async (dispatch, contact) => {
  dispatch(conversationOpened(contact.key));
  try {
    const params = contact.kind === 'room' ? { room: contact.id } : { with: contact.id };
    const { data } = await api.get('/messages', { params });
    dispatch(historyLoaded({ key: contact.key, messages: data }));
  } catch (error) {
    toast.error(error.message);
  }
};

const SideBar = ({ user, menuOpen, closeMenu }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const dispatch = useDispatch();
  const { contacts, order } = useSelector((state) => state.chat);

  const userContactIds = order.filter((key) => contacts[key].kind === 'user').map((key) => contacts[key].id);
  const userContactIdsKey = userContactIds.join(',');
  useEffect(() => {
    requestPresence(userContactIdsKey ? userContactIdsKey.split(',') : []);
  }, [userContactIdsKey]);

  const search = async (event) => {
    event.preventDefault();
    if (!query.trim()) return;
    try {
      const { data } = await api.get('/users/search', { params: { q: query.trim() } });
      if (data.length === 0) toast.info('No users found');
      setResults(data);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const selectResult = (found) => {
    dispatch(contactAdded({ id: found.id, name: found.username, kind: 'user' }));
    setResults([]);
    setQuery('');
    openConversation(dispatch, { key: `user:${found.id}`, id: found.id, kind: 'user' });
  };

  const list = results.length > 0
    ? results.map((found) => (
      <button type="button" key={found.id} className={SBstyle.user} onClick={() => selectResult(found)}>
        <FaCircleUser size={37.5} className={SBstyle.icon} />
        <div><p>{found.username}</p></div>
      </button>
    ))
    : order.map((key) => {
      const contact = contacts[key];
      const Icon = contact.kind === 'room' ? FaUsers : FaCircleUser;
      return (
        <button type="button" key={key} className={SBstyle.user} onClick={() => openConversation(dispatch, contact)}>
          <Icon size={37.5} className={SBstyle.icon} />
          <div>
            <p>
              {contact.name}
              {contact.unread && <span className={SBstyle.unread_messages} aria-label="unread messages"> ●</span>}
            </p>
            {contact.kind === 'user' && (
              <p className={contact.online ? SBstyle.online : SBstyle.offline}>{contact.online ? 'Online' : 'Offline'}</p>
            )}
            {contact.kind === 'room' && <p className={SBstyle.offline}>Room</p>}
          </div>
        </button>
      );
    });

  return (
    <div className={SBstyle.sidebar_container}>
      <div className={SBstyle.sidebar}>
        {menuOpen && <ToggableMenu close={closeMenu} user={user} />}
        <form onSubmit={search} className={SBstyle.sidebar_form}>
          <input className={SBstyle.search_input} type="text" placeholder="New Chat" value={query} onChange={(e) => setQuery(e.target.value)} />
          <FaSistrix className={SBstyle.search_icon} onClick={search} />
        </form>
        <div>{list}</div>
      </div>
    </div>
  );
};

export default SideBar;
