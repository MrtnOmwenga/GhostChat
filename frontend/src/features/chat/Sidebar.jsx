import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { FaMagnifyingGlass, FaCircleUser, FaUsers } from 'react-icons/fa6';
import { toast } from 'react-toastify';
import SBstyle from './Sidebar.module.css';
import api from '../../lib/api';
import { requestPresence } from '../../lib/socket';
import { openConversation, startDirectChat } from '../../lib/messaging';

const timeLabel = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

const ContactRow = ({
  name, kind, status, preview, at, unread, active, onClick,
}) => {
  const Icon = kind === 'room' ? FaUsers : FaCircleUser;
  return (
    <li>
      <button type="button" className={`${SBstyle.row} ${active ? SBstyle.active : ''}`} onClick={onClick}>
        <Icon size={34} className={SBstyle.avatar} aria-hidden="true" />
        <span className={SBstyle.rowText}>
          <span className={SBstyle.topLine}>
            <span className={SBstyle.name}>{name}</span>
            {at && <span className={SBstyle.time}>{at}</span>}
          </span>
          {preview !== undefined && <span className={SBstyle.preview}>{preview}</span>}
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
    setResults(null);
    setQuery('');
    startDirectChat(found).catch((error) => toast.error(error.message));
  };

  let list;
  if (results) {
    list = results.length === 0
      ? <p className={SBstyle.empty}>No users found</p>
      : results.map((found) => <ContactRow key={found.id} name={found.username} kind="user" onClick={() => selectResult(found)} />);
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
          preview={contact.preview ?? (contact.kind === 'room' ? 'Room' : (contact.online ? 'Online' : 'Offline'))}
          status={contact.preview !== undefined && contact.kind === 'user' ? (contact.online ? 'Online' : 'Offline') : null}
          at={timeLabel(contact.previewAt)}
          unread={contact.unread}
          active={key === active}
          onClick={() => openConversation(key).catch((error) => toast.error(error.message))}
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
