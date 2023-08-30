import axios from 'axios';

const Search = async (username, user) => {
  const response = await axios.get('/api/users/search', { params: { username, user } });
  return response.data;
};

export default {
  Search,
};
