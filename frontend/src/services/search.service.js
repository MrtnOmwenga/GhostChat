import axios from 'axios';
import token from './token.service';

const Auth = token.getToken();

const Search = async (username, user) => {
  const config = {
    headers: { 
      Authorization: `Bearer ${Auth.token}`,
      'Cookie': Auth.csrfCookie,
      'x-csrf-token': Auth.csrfToken 
    },
    params: { username, user },
  };

  const response = await axios.get('/api/users/search', config)
    .catch((error) => {
      throw new Error(error.response.data);
    });
  return response.data;
};

export default {
  Search,
};
