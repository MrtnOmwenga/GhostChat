import axios from 'axios';

const BaseUrl = '/api/users';

const Register = async (credentials) => {
  const response = await axios.post(BaseUrl, credentials)
    .catch((error) => {
      throw new Error(error.response.data);
    });
  return response.data;
};

export default { Register };
