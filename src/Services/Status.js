import axios from 'axios';

const UpdateUser = async (id, NewObject) => {
  const response = await axios.put(`/api/users/${id}`, NewObject);
  return response.data;
};

export default {
  UpdateUser,
};
