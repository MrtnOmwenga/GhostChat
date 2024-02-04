const LoginRoutes = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Users = require('../models/user.model');
const { ValidateLogin } = require('../services/user-validator.service');

LoginRoutes.post('/', async (request, response) => {
  const { username, password } = request.body;

  // Validate request body
  const validation = ValidateLogin({ username, password});
  if (validation.error) {
    // Handle validation error
    console.error('Validation error:', validation.error.details);
    return response.status(400).json({ error: 'Validation error', message: error.message });
  }

  // Get correct password and compare
  const user = await Users.findOne({ username });
  const CorrectPassword = user === null ? false : await bcrypt.compare(password, user.password);

  if (!(user && CorrectPassword)) {
    return response.status(401).send('Incorrect username or password');
  }

  // Make token
  const token = jwt.sign({
    name: user.name,
    id: user._id,
  }, process.env.SECRET);

  return response
    .status(200)
    .json({
      token,
      username: user.username,
      id: user._id,
    });
});

module.exports = LoginRoutes;
