import axios from 'axios';

let token = null;

/**
 * The function `SetToken` sets the value of the `token` variable to a new token value with the
 * "Bearer" prefix.
 * @param newToken - The `newToken` parameter is a string that represents the new token
 * value that will be set.
 */
const SetToken = (newToken) => {
  token = `Bearer ${newToken}`;
};

/**
 * The function `UpdateUser` is an asynchronous function that updates a user's information
 * using a PUT request to an API endpoint.
 * @param id - The id parameter is the unique identifier of the user that you want to update.
 * @param NewObject - The `NewObject` parameter is an object that contains the updated
 * information for the user. It could include properties such as `name`, `email`,
 * `password`, or any other relevant user information that needs to be updated.
 * @returns The data from the response of the PUT request to the `/api/users/` endpoint.
 */
const UpdateUser = async (id, NewObject) => {
  const config = {
    headers: { Authorization: token },
  };

  const response = await axios.put(`/api/users/${id}`, NewObject, config);
  return response.data;
};

export default {
  UpdateUser, SetToken,
};
