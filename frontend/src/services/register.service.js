import axios from 'axios';
import token from './token.service';

const BaseUrl = '/api/users';
const Auth = token.getToken();

const Register = async (credentials) => {
  const response = await axios.post(BaseUrl, credentials, {
      headers: {
        'Cookie': Auth.csrfCookie,
        'x-csrf-token': Auth.csrfToken
      }
    }).catch((error) => {
      throw new Error(error.response.data);
    });
  return response.data;
};

const DeleteAccount = async (id) => {
  const config = {
    headers: { 
      Authorization: `Bearer ${Auth.token}`,
      'Cookie': Auth.csrfCookie,
      'x-csrf-token': Auth.csrfToken 
    },
  };

  const response = await axios.delete(`${BaseUrl}/${id}`, config)
    .catch((error) => {
      throw new Error(error.response.data);
    });
  return response.data;
};

export default { Register, DeleteAccount };
