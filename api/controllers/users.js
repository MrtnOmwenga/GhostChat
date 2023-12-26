const UserRoutes = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const Users = require('../models/users');
require('express-async-errors');

UserRoutes.get('/', async (request, response) => {
  const auth = request.token;

  if (!auth) {
    return response.status(400).send('Invalid Token');
  }

  const users = await Users.find({});
  return response.json(users);
});

UserRoutes.get('/search', async (request, response) => {
  const { username, user } = request.query;

  const auth = request.token;

  if (!auth) {
    return response.status(400).send('Invalid Token');
  }

  const users = await Users.find({
    $and: [
      { username: { $regex: `^${username}` } },
      { username: { $ne: user } },
    ],
  });
  return response.json(users);
});

UserRoutes.get('/:id', async (request, response) => {
  const auth = request.token;

  if (!auth) {
    return response.status(400).send('Invalid Token');
  }

  const users = await Users.findById(request.params.id);
  return response.json(users);
});

UserRoutes.post('/', async (request, response) => {
  const { username, password } = request.body;

  if (!username || !password) {
    return response.status(400).send('Please fill all fields.');
  }

  const exists = await Users.findOne({ username });
  if (exists) {
    return response.status(500).send('User already exists');
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
  const auth = request.token;

  if (!auth) {
    return response.status(400).send('Invalid Token');
  }

  const result = await Users.findByIdAndUpdate(
    request.params.id,
    { $set: request.body },
    { new: true },
  );
  return response.status(200).json(result);
});

UserRoutes.delete('/:id', async (request, response) => {
  const auth = request.token;
  if (!auth) {
    return response.status(400).send('Invalid Token');
  }

  const RequestedUser = await Users.findById(request.params.id);

  if (!RequestedUser) {
    return response.status(405).send('User not found');
  }

  await Users.deleteOne({ _id: new ObjectId(request.params.id) });
  return response.status(204).end();
});

module.exports = UserRoutes;
