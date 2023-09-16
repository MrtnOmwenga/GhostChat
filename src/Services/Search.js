import axios from 'axios';

let token = null;

const SetToken = (newToken) => {
  token = `Bearer ${newToken}`;
};

const Search = async (username, user) => {
  const config = {
    headers: { Authorization: token },
    params: { username, user },
  };

  const response = await axios.get('/api/users/search', config)
    .catch((error) => {
      throw new Error(error.response.data);
    });
  return response.data;
};

export default {
  Search, SetToken,
};
