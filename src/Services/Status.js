import axios from 'axios';

let token = null;

const SetToken = (newToken) => {
  token = `Bearer ${newToken}`;
};

const UpdateUser = async (id, NewObject) => {
  const config = {
    headers: { Authorization: token },
  };

  const response = await axios.put(`/api/users/${id}`, NewObject, config);
  return response.data;
};

export default {
  UpdateUser, SetToken,
};
