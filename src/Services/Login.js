import axios from 'axios';

const BaseUrl = '/services/login';

const Login = async (credentials) => {
  const response = await axios.post(BaseUrl, credentials)
    .catch((error) => {
      throw new Error(error.response.data);
    });
  return response.data;
};

export default { Login };
