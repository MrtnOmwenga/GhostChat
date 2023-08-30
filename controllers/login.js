const LoginRoutes = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Users = require('../models/users');

LoginRoutes.post('/', async (request, response) => {
  const { username, password } = request.body;

  const user = await Users.findOne({ username });
  const CorrectPassword = user === null ? false : await bcrypt.compare(password, user.password);

  if (!(user && CorrectPassword)) {
    return response.status(401).send('Incorrect username or password');
  }

  const forToken = {
    name: user.name,
    id: user._id,
  };
  const token = jwt.sign(forToken, process.env.SECRET);

  return response
    .status(200)
    .json({
      token,
      username: user.username,
      id: user._id,
    });
});

module.exports = LoginRoutes;
