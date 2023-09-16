import Search from './Search';
import Status from './Status';
import Rooms from './Rooms';
import Register from './Register';

const SetToken = (newToken) => {
  Search.SetToken(newToken);
  Status.SetToken(newToken);
  Rooms.SetToken(newToken);
  Register.SetToken(newToken);
};

export default {
  SetToken,
};
