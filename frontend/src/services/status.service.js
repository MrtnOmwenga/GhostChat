import axios from 'axios';
import token from './token.service';

const Auth = token.getToken();

const UpdateUser = async (id, NewObject) => {
  const config = {
    headers: { 
      Authorization: `Bearer ${Auth.token}`,
      'Cookie': Auth.csrfCookie,
      'x-csrf-token': Auth.csrfToken 
    },
  };

  const response = await axios.put(`/api/users/${id}`, NewObject, config);
  return response.data;
};

export default {
  UpdateUser,
};
