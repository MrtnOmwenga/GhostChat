import axios from 'axios';

let token = null;

const SetToken = (newToken) => {
  token = `Bearer ${newToken}`;
};

const CreateRoom = async (name, password) => {
  const config = {
    headers: { Authorization: token },
  };

  const response = await axios.post('/api/rooms', { params: { name, password } }, config)
    .catch((error) => {
      throw new Error(error.response.data);
    });
  return response.data;
};

const JoinRoom = async (name, password) => {
  const config = {
    headers: { Authorization: token },
  };

  const response = await axios.post('/api/rooms/join', { params: { name, password } }, config)
    .catch((error) => {
      throw new Error(error.response.data);
    });
  return response.data;
};

const MyRooms = async (id) => {
  const config = {
    headers: { Authorization: token },
  };

  const response = await axios.get(`/api/rooms/${id}`, config)
    .catch((error) => {
      throw new Error(error.response.data);
    });
  return response.data;
};

export default {
  CreateRoom, SetToken, JoinRoom, MyRooms,
};
