import React, { useState } from 'react';
import { FaSistrix, FaCircleUser } from 'react-icons/fa6';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import DataServices from '../Services/Search';
import style from '../Assets/Style/SideBar.module.css';
// import log from '../Utils/logger';

const SideBar = ({ socket, ChangeUser, token }) => {
  const [search, setSearch] = useState('');
  const [chats, setChats] = useState([]);
  const [SearchList, setSearchList] = useState([]);

  socket?.on('changed-socket', (id, status, SocketId) => {
    const SearchIndex = SearchList.findIndex((x) => x.id === id);
    const ChatIndex = chats.findIndex((x) => x._id === id);
    if (SearchIndex !== -1) {
      const DuplicateSearchList = SearchList;
      DuplicateSearchList[SearchIndex].socket_id = SocketId;
      DuplicateSearchList[SearchIndex].status = status;
      setSearchList(DuplicateSearchList);
    }
    if (ChatIndex !== -1) {
      const DuplicateChatList = chats;
      DuplicateChatList[ChatIndex].socket_id = SocketId;
      DuplicateChatList[ChatIndex].status = status;
      ChangeUser(DuplicateChatList[ChatIndex]);
      setSearchList(DuplicateChatList);
    }
  });

  const HandleChange = (event) => {
    setSearch(event.target.value);
  };

  const Search = async () => {
    try {
      const response = await DataServices.Search(search, token.username);
      const UpdatedList = response.map((user) => {
        const UserObject = user;
        socket.emit('status', UserObject._id, (status, SocketId) => {
          UserObject.status = status;
          UserObject.socket_id = SocketId;
        });
        return UserObject;
      });
      setSearchList(SearchList.concat(UpdatedList));
      if (UpdatedList.length === 0) {
        setSearchList(SearchList.concat({ username: 'User not found' }));
      }
    } catch (error) {
      toast.error(error);
    }
  };

  const Select = (object) => {
    if (object.username !== 'User not found') {
      if (chats.indexOf(object) === -1) {
        setChats(chats.concat(object));
      }
      ChangeUser(object);
    }
    setSearchList([]);
    setSearch('');
  };

  const ListToDisplay = SearchList.length !== 0 ? SearchList : chats;

  return (
    <div className={style.sidebar}>
      <form>
        <input className={style.search_input} type="text" placeholder="New Chat" value={search} onChange={HandleChange} />
        <FaSistrix className={style.search_icon} onClick={Search} />
      </form>
      <div>
        {ListToDisplay.map((chat) => (
          <button type="button" className={style.user} onClick={() => Select(chat)}>
            <FaCircleUser size={37.5} className={style.icon} />
            <div>
              <p>{chat.username}</p>
              {chat.status === 'online' && <p className={style.online}>Online</p>}
              {chat.status === 'offline' && <p className={style.offline}>Offline</p>}
            </div>
          </button>
        ))}
      </div>
      <ToastContainer />
    </div>
  );
};

export default SideBar;
