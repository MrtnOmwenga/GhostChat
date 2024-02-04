const UserRoutes = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const Users = require('../models/user.model.js');
const { ValidateUser, ValidateMongoId, UserExists, isUsernameUnique } = require('../services/user-validator.service.js');
require('express-async-errors');

UserRoutes.get('/', async (request, response) => {
  // Check that user is validated
  if (!request.token) {
    return response.status(401).send({ 'error': 'Unauthorized' });
  }

  const users = await Users.find({});
  return response.json(users);
});

UserRoutes.get('/search', async (request, response) => {
  const { username, user } = request.query;

  // Check that user is validated
  if (!request.token) {
    return response.status(401).send({ 'error': 'Unauthorized' });
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
  // Check that user is validated
  if (!request.token) {
    return response.status(401).send({ 'error': 'Unauthorized' });
  }

  // Validate ID
  const validation = ValidateMongoId(request.params.id);
  if (validation.error) {
    // Handle validation error
    console.log(validation.error.message);
    console.error('Validation error:', validation.error.details);
    return response.status(400).json({ error: 'Validation error', message: validation.error.message });
  }

  try {
    await UserExists(request.params.id);
  } catch (error) {
    return response.status(404).json({ error: 'Validation error', message: error.message });
  }

  const users = await Users.findById(request.params.id);
  return response.json(users);
});

UserRoutes.post('/', async (request, response) => {
  const { username, password } = request.body;

  // Validate request body
  const validation = ValidateUser({ username, password});
  if (validation.error) {
    // Handle validation error
    console.error('Validation error:', validation.error.details);
    return response.status(400).json({ error: 'Validation error', message: validation.error.message });
  }

  // Check username is unique
  try {
    await isUsernameUnique(username)
  } catch (error) {
    return response.status(400).json({ error: 'Validation error', message: error.message });
  }

  // Encrypt password and save user
  const NewUser = new Users({
    username,
    password: await bcrypt.hash(password, 10),
  });
  const result = await NewUser.save();

  // Create token
  const token = jwt.sign({
    name: result.name,
    id: result._id,
  }, process.env.SECRET);

  return response.status(201).json({
    token,
    username: result.username,
    id: result._id,
  });
});

UserRoutes.put('/:id', async (request, response) => {
  // Check that user is validated
  if (!request.token) {
    return response.status(401).send({ 'error': 'Unauthorized' });
  }

  // Validate ID
  const IDValidation = ValidateMongoId(request.params.id);
  if (IDValidation.error) {
    // Handle validation error
    console.error('Validation error:', IDValidation.error.details);
    return response.status(400).json({ error: 'Validation error', message: IDValidation.error.message });
  }

  // Validate user data
  const UserValidation = ValidateUser(request.body);
  if (UserValidation.error) {
    // Handle validation error
    console.error('Validation error:', UserValidation.error.details);
    return response.status(400).json({ error: 'Validation error', message: UserValidation.error.message });
  }

  // Check if user exists
  try {
    await UserExists(request.params.id);
  } catch (error) {
    return response.status(404).json({ error: 'Validation error', message: error.message });
  }

  // Update user data
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
    return response.status(401).send({ 'error': 'Unauthorized' });
  }

  // Validate ID
  const validation = ValidateMongoId(request.params.id);
  if (validation.error) {
    // Handle validation error
    console.error('Validation error:', validation.error.details);
    return response.status(400).json({ error: 'Validation error', message: validation.error.message });
  }

  // Check if user exists
  try {
    await UserExists(request.params.id);
  } catch (error) {
    return response.status(404).json({ error: 'Validation error', message: error.message });
  }

  await Users.deleteOne({ _id: new ObjectId(request.params.id) });
  return response.status(204).end();
});

module.exports = UserRoutes;
