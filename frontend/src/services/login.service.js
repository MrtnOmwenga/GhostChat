import axios from 'axios';

const BaseUrl = '/services/login';

const Login = async (credentials) => {
  const csrfResponse = await axios.get('/services/csrf');
  const csrfToken = csrfResponse.data.csrfToken;
  const csrfCookie = csrfResponse.headers['set-cookie'];

  const response = await axios.post(BaseUrl, credentials, {
      headers: {
        'Cookie': csrfCookie,
        'x-csrf-token': csrfToken
      }
    }).catch((error) => {
      throw new Error(error.response.data);
    });
  return response.data;
};

export default { Login };
