import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaMagnifyingGlass, FaCircleUser, FaUsers } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import SBstyle from './Sidebar.module.css';
import api from '../../lib/api';
import { requestPresence } from '../../lib/socket';
import { contactAdded, conversationOpened, historyLoaded } from './chatSlice';

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

const ContactRow = ({ name, kind, status, unread, active, onClick }) => {
  const Icon = kind === 'room' ? FaUsers : FaCircleUser;
  return (
    <li>
      <button type="button" className={`${SBstyle.row} ${active ? SBstyle.active : ''}`} onClick={onClick}>
        <Icon size={34} className={SBstyle.avatar} aria-hidden="true" />
        <span className={SBstyle.rowText}>
          <span className={SBstyle.name}>{name}</span>
          {status && <span className={`${SBstyle.status} ${status === 'Online' ? SBstyle.online : ''}`}>{status}</span>}
        </span>
        {unread && <span className={SBstyle.unread} aria-label="Unread messages" />}
      </button>
    </li>
  );
};

const SideBar = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const dispatch = useDispatch();
  const { contacts, order, active } = useSelector((state) => state.chat);

  const userIdsKey = order.filter((key) => contacts[key].kind === 'user').map((key) => contacts[key].id).join(',');
  useEffect(() => {
    requestPresence(userIdsKey ? userIdsKey.split(',') : []);
  }, [userIdsKey]);

  const search = async (event) => {
    event.preventDefault();
    if (!query.trim()) {
      setResults(null);
      return;
    }
    try {
      const { data } = await api.get('/users/search', { params: { q: query.trim() } });
      setResults(data);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const selectResult = (found) => {
    dispatch(contactAdded({ id: found.id, name: found.username, kind: 'user' }));
    setResults(null);
    setQuery('');
    openConversation(dispatch, { key: `user:${found.id}`, id: found.id, kind: 'user' });
  };

  let list;
  if (results) {
    list = results.length === 0
      ? <p className={SBstyle.empty}>No users found</p>
      : results.map((found) => (
        <ContactRow key={found.id} name={found.username} kind="user" onClick={() => selectResult(found)} />
      ));
  } else if (order.length === 0) {
    list = <p className={SBstyle.empty}>Search for someone by username, or create a room from the menu.</p>;
  } else {
    list = order.map((key) => {
      const contact = contacts[key];
      return (
        <ContactRow
          key={key}
          name={contact.name}
          kind={contact.kind}
          status={contact.kind === 'room' ? 'Room' : (contact.online ? 'Online' : 'Offline')}
          unread={contact.unread}
          active={key === active}
          onClick={() => openConversation(dispatch, contact)}
        />
      );
    });
  }

  return (
    <aside className={SBstyle.sidebar} aria-label="Conversations">
      <form onSubmit={search} className={SBstyle.search} role="search">
        <label className="sr-only" htmlFor="user-search">Search users</label>
        <input id="user-search" type="search" placeholder="New chat: search usernames" value={query} onChange={(e) => { setQuery(e.target.value); if (!e.target.value) setResults(null); }} />
        <button type="submit" aria-label="Search"><FaMagnifyingGlass aria-hidden="true" /></button>
      </form>
      <ul className={SBstyle.list}>{list}</ul>
    </aside>
  );
};

export default SideBar;
