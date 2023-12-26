import Search from './Search';
import Status from './Status';
import Rooms from './Rooms';
import Register from './Register';

/**
 * The function SetToken sets a new token for various modules.
 * @param newToken - The `newToken` parameter is a variable that represents a new token value.
 */
const SetToken = (newToken) => {
  Search.SetToken(newToken);
  Status.SetToken(newToken);
  Rooms.SetToken(newToken);
  Register.SetToken(newToken);
};

export default {
  SetToken,
};
