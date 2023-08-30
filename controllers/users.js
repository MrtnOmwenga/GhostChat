const UserRoutes = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Users = require('../models/users');
require('express-async-errors');

UserRoutes.get('/', async (request, response) => {
  const users = await Users.find({});
  response.json(users);
});

UserRoutes.get('/search', async (request, response) => {
  const { username, user } = request.query;
  const users = await Users.find({
    $and: [
      { username: { $regex: `^${username}` } },
      { username: { $ne: user } },
    ],
  });
  response.json(users);
});

UserRoutes.get('/:id', async (request, response) => {
  const users = await Users.findById(request.params.id);
  response.json(users);
});

UserRoutes.post('/', async (request, response) => {
  const { username, password } = request.body;

  if (!username || !password) {
    return response.status(400).send('Please fill all fields.');
  }

  if (password.length < 6) {
    return response.status(400).send('The password must be at least 6 characters long.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const NewUser = new Users({
    username,
    password: passwordHash,
  });

  const result = await NewUser.save();

  const forToken = {
    name: result.name,
    id: result._id,
  };
  const token = jwt.sign(forToken, process.env.SECRET);

  return response.status(201).json({
    token,
    username: result.username,
    id: result._id,
  });
});

UserRoutes.put('/:id', async (request, response) => {
  const result = await Users.findByIdAndUpdate(
    request.params.id,
    { $set: request.body },
    { new: true },
  );
  return response.status(200).json(result);
});

module.exports = UserRoutes;
