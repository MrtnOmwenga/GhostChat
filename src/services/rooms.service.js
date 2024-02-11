import axios from 'axios';
import token from './token.service';

const CreateRoom = async (name, password) => {
  const config = {
    headers: { Authorization: `Bearer ${token.getToken()}` },
  };

  const response = await axios.post('/api/rooms', { params: { name, password } }, config)
    .catch((error) => {
      throw new Error(error.response.data);
    });
  return response.data;
};

const JoinRoom = async (name, password) => {
  const config = {
    headers: { Authorization: `Bearer ${token.getToken()}` },
  };

  const response = await axios.post('/api/rooms/join', { params: { name, password } }, config)
    .catch((error) => {
      throw new Error(error.response.data);
    });
  return response.data;
};

const MyRooms = async (id) => {
  const config = {
    headers: { Authorization: `Bearer ${token.getToken()}` },
  };

  const response = await axios.get(`/api/rooms/${id}`, config)
    .catch((error) => {
      throw new Error(error.response.data);
    });
  return response.data;
};

export default {
  CreateRoom, JoinRoom, MyRooms,
};
