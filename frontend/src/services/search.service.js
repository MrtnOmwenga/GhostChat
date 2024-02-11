import axios from 'axios';
import token from './token.service';

const Search = async (username, user) => {
  const config = {
    headers: { Authorization: `Bearer ${token.getToken()}` },
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
