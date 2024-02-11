import React, { useState, useEffect } from 'react';
import { FaSistrix, FaCircleUser, FaC } from 'react-icons/fa6';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useSelector, useDispatch } from 'react-redux'; // Import useSelector from react-redux
import DataServices from '../services/search.service';
import style from '../assets/style/sidebar.module.css';
import socket from '../services/socket.service';
import ToggableMenu from './toggable.component';
import { AddContact, UpdateContact, UpdateRecipient } from '../services/message.service';
// import log from '../utils/logger.utils';

const SideBar = ({ user, view, close }) => {
  const [search, setSearch] = useState('');
  const [chats, setChats] = useState([]);
  const [SearchList, setSearchList] = useState([]);

  const dispatch = useDispatch();
  const contacts = useSelector((state) => state.contacts);
  useEffect(() => {
    const fetchData = async () => {
      const initialChats = await Promise.all(contacts.map(async (contact) => {
        if (contact.status !== 'group') {
          const status = await socket.status(contact.id);
          return {
            username: contact.username,
            id: contact.id,
            UnreadMessages: true,
            ...status,
          };
        }
        return contact;
      }));
      setChats(initialChats);
    };

    fetchData();
  }, [contacts]);

  // Store search value to state
  const HandleChange = (event) => {
    setSearch(event.target.value);
  };

  // Search for users in the database
  const Search = async (event) => {
    event.preventDefault();
    try {
      // Check for user in database
      const response = await DataServices.Search(search, user.username);

      // If returned list is empty, raise error to inform user no
      // users with that username were found
      if (response.length === 0) {
        toast.error('User not found');
      }

      // Get information of all returned users
      const updatedListPromises = response.map(async (UserObject) => {
        const status = await socket.status(UserObject.id);
        return { ...UserObject, ...status };
      });

      // Wait for all promises to resolve
      const UpdatedList = await Promise.all(updatedListPromises);

      // Append this information to SearchList
      setSearchList(SearchList.concat(UpdatedList));

      // Clear search field
      setSearch('');
    } catch (error) {
      // Raise error if anything goes wrong
      toast.error(`${error}`);
    }
  };

  // Handle current user selecting who they currently want to speak to
  const Select = (object) => {
    if (object.username !== 'User not found') {
      const ind = chats.findIndex((x) => x.username === object.username);
      if (ind === -1) {
        // Dispatch an action to add a new chat
        dispatch(AddContact(object));
      } else {
        // Dispatch an action to update the chat with unread messages flag
        dispatch(UpdateContact(object.id, { UnreadMessages: false }));
      }
      dispatch(UpdateRecipient(object));
    }
    setSearchList([]);
    setSearch('');
  };

  // Determine which list to display
  const ListToDisplay = SearchList.length !== 0 ? SearchList : chats;

  return (
    <div className={style.sidebar_container}>
      <div className={style.sidebar}>
        {view !== 'none' && (
        <ToggableMenu
          socket={socket}
          close={close}
          chats={chats}
          setChats={setChats}
          user={user}
        />
        )}
        <form onSubmit={Search}>
          <input className={style.search_input} type="text" placeholder="New Chat" value={search} onChange={HandleChange} />
          <FaSistrix className={style.search_icon} onClick={Search} />
        </form>
        <div>
          {ListToDisplay.map((chat) => (
            <button type="button" className={style.user} onClick={() => Select(chat)}>
              <FaCircleUser size={37.5} className={style.icon} />
              <div>
                <p>
                  {chat.username}
                  &nbsp; &nbsp;
                  {chat.UnreadMessages && <FaC size={10} className={style.unread_messages} />}
                </p>
                {chat.status === 'online' && <p className={style.online}>Online</p>}
                {chat.status === 'offline' && <p className={style.offline}>Offline</p>}
              </div>
            </button>
          ))}
        </div>
      </div>
      <ToastContainer />
    </div>
  );
};

export default SideBar;
