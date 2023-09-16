import React, { useState, useEffect } from 'react';
import { FaSistrix, FaCircleUser, FaC } from 'react-icons/fa6';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import DataServices from '../Services/Search';
import style from '../Assets/Style/SideBar.module.css';
import ToggableMenu from './Toggable';
// import log from '../Utils/logger';

const RemoveDuplicates = (List) => {
  const ids = List.map((object) => object.username);
  const filtered = List.filter((object, index) => !ids.includes(object.username, index + 1));

  return filtered;
};

const SideBar = ({
  socket, ChangeUser, User, view, close,
}) => {
  const [search, setSearch] = useState('');
  const [chats, setChats] = useState([]);
  const [SearchList, setSearchList] = useState([]);

  useEffect(() => {
    socket?.emit('now-online', User.id, (MessageList) => {
      const List = MessageList?.map(async (MessageObject) => {
        const ChatObject = {
          username: MessageObject.from.username,
          id: MessageObject.from.id,
          UnreadMessages: true,
        };
        await socket.emit('status', MessageObject.from.id, (status, SocketId) => {
          ChatObject.status = status;
          ChatObject.socket_id = SocketId;
        });
        return ChatObject;
      });
      if (List) {
        Promise.all(List.filter((object) => object !== null))
          .then((values) => {
            setChats(chats.concat(RemoveDuplicates(values)));
          });
      }
    });
  }, [socket]);

  socket?.on('changed-socket', (id, status, SocketId) => {
    const UpdatedList = chats.map((chat) => {
      const NewChat = { ...chat };
      if (NewChat.id === id) {
        NewChat.socket_id = SocketId;
        NewChat.status = status;
      }
      ChangeUser(NewChat);
      return NewChat;
    });
    setChats(UpdatedList);
  });

  socket?.on('receive-message', (message) => {
    const DuplicateChatList = chats;
    const Index = DuplicateChatList.findIndex((object) => object.id === message.from.id);
    if (Index === -1) {
      const NewObject = message.from;
      NewObject.UnreadMessages = true;
      setChats(chats.concat(NewObject));
    } else {
      DuplicateChatList[Index].UnreadMessages = true;
      setChats(DuplicateChatList);
    }
  });

  const HandleChange = (event) => {
    setSearch(event.target.value);
  };

  const Search = async (event) => {
    event.preventDefault();
    try {
      const response = await DataServices.Search(search, User.username);
      const UpdatedList = response.map((user) => {
        const UserObject = user;
        UserObject.id = user._id;
        delete UserObject._id;
        socket.emit('status', UserObject.id, (status, SocketId) => {
          UserObject.status = status;
          UserObject.socket_id = SocketId;
          UserObject.UnreadMessages = false;
        });
        return UserObject;
      });
      setSearchList(SearchList.concat(UpdatedList));
      if (UpdatedList.length === 0) {
        toast.error('User not found');
      }
    } catch (error) {
      toast.error(`${error}`);
    }
  };

  const Select = (object) => {
    if (object.username !== 'User not found') {
      if (chats.indexOf(object) === -1) {
        setChats(chats.concat(object));
      } else {
        const DuplicateChatList = chats;
        const index = DuplicateChatList.indexOf(object);
        DuplicateChatList[index].UnreadMessages = false;
        setChats(DuplicateChatList);
      }
      ChangeUser(object);
    }
    setSearchList([]);
    setSearch('');
  };

  const ListToDisplay = SearchList.length !== 0 ? SearchList : chats;

  return (
    <div className={style.sidebar_container}>
      {view !== 'none' && (
      <ToggableMenu
        socket={socket}
        close={close}
        chats={chats}
        setChats={setChats}
        User={User}
      />
      )}
      <div className={style.sidebar}>
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
                  &nbsp;
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
