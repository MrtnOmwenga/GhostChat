const UserRoutes = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const csrf = require('csurf');
const Users = require('../models/user.model.js');
const { ValidateUser, ValidateMongoId, UserExists, isUsernameUnique, ValidateSearch } = require('../services/user-validator.service.js');
require('express-async-errors');

const csrfProtection = csrf({ cookie: true });

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management endpoints
 */

/**
 * @swagger
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: Retrieve all users
 *     description: Retrieve a list of all users
 *     responses:
 *       '200':
 *         description: A list of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *   post:
 *     tags: [Users]
 *     summary: Create a new user
 *     description: Create a new user with a unique username and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       '201':
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 username:
 *                   type: string
 *                 id:
 *                   type: string
 *       '400':
 *         description: Validation error or username already exists
 *       '401':
 *         description: Unauthorized request
 */
UserRoutes.get('/', async (request, response) => {
  // Check that user is validated
  if (!request.token) {
    return response.status(401).send({ 'error': 'Unauthorized' });
  }

  const users = await Users.find({});
  return response.json(users);
});

/**
 * @swagger
 * /users/search:
 *   get:
 *     tags: [Users]
 *     summary: Search for users
 *     description: Retrieve a list of users based on username search
 *     parameters:
 *       - in: query
 *         name: username
 *         required: true
 *         description: Username to search for
 *         schema:
 *           type: string
 *       - in: query
 *         name: user
 *         required: true
 *         description: Current user's username
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: A list of users matching the search criteria
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       '401':
 *         description: Unauthorized request
 */
UserRoutes.get('/search', async (request, response) => {
  const { username, user } = request.query;

  // Check that user is validated
  if (!request.token) {
    return response.status(401).send({ 'error': 'Unauthorized' });
  }

  // Validate ID
  const validation = ValidateSearch({ username, user });
  if (validation.error) {
    // Handle validation error
    console.log(validation.error.message);
    console.error('Validation error:', validation.error.details);
    return response.status(400).json({ error: 'Validation error', message: validation.error.message });
  }

  const users = await Users.find({
    $and: [
      { username: { $regex: `^${username}` } },
      { username: { $ne: user } },
    ],
  });
  return response.json(users);
});

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Retrieve a user by ID
 *     description: Retrieve a user's details by their ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the user to retrieve
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: User found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       '400':
 *         description: Invalid ID format
 *       '401':
 *         description: Unauthorized request
 *       '404':
 *         description: User not found
 *   put:
 *     tags: [Users]
 *     summary: Update a user by ID
 *     description: Update a user's details by their ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the user to update
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       '200':
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       '400':
 *         description: Validation error or invalid ID format
 *       '401':
 *         description: Unauthorized request
 *       '404':
 *         description: User not found
 *   delete:
 *     tags: [Users]
 *     summary: Delete a user by ID
 *     description: Delete a user by their ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the user to delete
 *         schema:
 *           type: string
 *     responses:
 *       '204':
 *         description: User deleted successfully
 *       '400':
 *         description: Invalid ID format
 *       '401':
 *         description: Unauthorized request
 *       '404':
 *         description: User not found
 */
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

UserRoutes.post('/', csrfProtection, async (request, response) => {
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

  // Hash the password using bcrypt
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    // Create a new user using Mongoose create method with the hashed password
    const newUser = await Users.create({ username, password: hashedPassword });
    
    // Create a JWT token
    const token = jwt.sign({
      name: newUser.name,
      id: newUser._id,
    }, process.env.SECRET);

    // Return the token, username, and ID in the response
    return response.status(201).json({
      token,
      username: newUser.username,
      id: newUser._id,
    });
  } catch (error) {
    // Handle any database errors
    console.error('Database error:', error.message);
    return response.status(500).json({ error: 'Database error', message: 'Failed to create user' });
  }
});

UserRoutes.put('/:id', csrfProtection, async (request, response) => {
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

  try {
    // Update user data using Mongoose findByIdAndUpdate method
    const result = await Users.findByIdAndUpdate(
      request.params.id,
      { $set: request.body },
      { new: true },
    );
    return response.status(200).json(result);
  } catch (error) {
    // Handle any database errors
    console.error('Database error:', error.message);
    return response.status(500).json({ error: 'Database error', message: 'Failed to update user' });
  }
});

UserRoutes.delete('/:id', csrfProtection, async (request, response) => {
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

  try {
    // Delete user using Mongoose deleteOne method
    await Users.deleteOne({ _id: new ObjectId(request.params.id) });
    return response.status(204).end();
  } catch (error) {
    // Handle any database errors
    console.error('Database error:', error.message);
    return response.status(500).json({ error: 'Database error', message: 'Failed to delete user' });
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier for the user
 *         username:
 *           type: string
 *           description: Username of the user
 *         password:
 *           type: string
 *           description: Password of the user
 *       required:
 *         - username
 *         - password
 */

module.exports = UserRoutes;
