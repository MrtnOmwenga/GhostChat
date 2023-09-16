import axios from 'axios';

const BaseUrl = '/api/users';
let token = null;

const SetToken = (newToken) => {
  token = `Bearer ${newToken}`;
};

const Register = async (credentials) => {
  const response = await axios.post(BaseUrl, credentials)
    .catch((error) => {
      throw new Error(error.response.data);
    });
  return response.data;
};

const DeleteAccount = async (id) => {
  const config = {
    headers: { Authorization: token },
  };

  const response = await axios.delete(`${BaseUrl}/${id}`, config)
    .catch((error) => {
      throw new Error(error.response.data);
    });
  return response.data;
};

export default { Register, DeleteAccount, SetToken };
