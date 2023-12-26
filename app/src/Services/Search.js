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
 * The Search function is an asynchronous function that makes a GET request to the
 * '/api/users/search' endpoint with the provided username and user parameters, and
 * returns the response data.
 * @param username - The `username` parameter is the username of the user you want to
 * search for. It is used as a query parameter in the API request to search for users
 * with a specific username.
 * @param user - The `user` parameter is the user object that you want to search for.
 * It could be an object containing information about the user, such as their name,
 *  email, or any other relevant details.
 * @returns the data from the response of the API call.
 */
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
