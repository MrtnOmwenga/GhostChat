import axios from 'axios';
import token from './token.service';

const UpdateUser = async (id, NewObject) => {
  const config = {
    headers: { Authorization: `Bearer ${token.getToken()}` },
  };

  const response = await axios.put(`/api/users/${id}`, NewObject, config);
  return response.data;
};

export default {
  UpdateUser,
};
