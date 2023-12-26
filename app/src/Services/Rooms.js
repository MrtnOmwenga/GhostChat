import axios from 'axios';

let token = null;

/**
 * The function `SetToken` sets the value of the `token` variable to a new token value with the
 * "Bearer" prefix.
 * @param newToken - The `newToken` parameter is a string that represents the new token value
 * that will be set.
 */
const SetToken = (newToken) => {
  token = `Bearer ${newToken}`;
};

/**
 * The CreateRoom function sends a POST request to create a new room with a given name and password.
 * @param name - The name parameter is the name of the room that you want to create. It is a string
 * value.
 * @param password - The `password` parameter is used to specify the password for the room being
 * created.
 * @returns The function `CreateRoom` is returning the `response.data` from the axios post request.
 */
const CreateRoom = async (name, password) => {
  const config = {
    headers: { Authorization: token },
  };

  const response = await axios.post('/api/rooms', { params: { name, password } }, config)
    .catch((error) => {
      throw new Error(error.response.data);
    });
  return response.data;
};

/**
 * The JoinRoom function sends a POST request to join a room with a given name and password, and
 * returns the response data.
 * @param name - The `name` parameter is the name of the room that you want to join. It is a string
 * value.
 * @param password - The `password` parameter is the password required to join the room. It is
 * used to authenticate the user and grant access to the room.
 * @returns The function `JoinRoom` is returning the `response.data` from the API call.
 */
const JoinRoom = async (name, password) => {
  const config = {
    headers: { Authorization: token },
  };

  const response = await axios.post('/api/rooms/join', { params: { name, password } }, config)
    .catch((error) => {
      throw new Error(error.response.data);
    });
  return response.data;
};

/**
 * The function `MyRooms` makes an asynchronous request to retrieve room data based on an ID,
 * using an authorization token.
 * @param id - The `id` parameter is the identifier of the room that you want to retrieve
 * information for.
 * @returns The function `MyRooms` returns the data from the response of the axios GET request.
 */
const MyRooms = async (id) => {
  const config = {
    headers: { Authorization: token },
  };

  const response = await axios.get(`/api/rooms/${id}`, config)
    .catch((error) => {
      throw new Error(error.response.data);
    });
  return response.data;
};

export default {
  CreateRoom, SetToken, JoinRoom, MyRooms,
};
