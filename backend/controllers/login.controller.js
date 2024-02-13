const LoginRoutes = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Users = require('../models/user.model');
const { ValidateLogin } = require('../services/user-validator.service');

/**
 * @swagger
 * tags:
 *   name: Login
 *   description: Login endpoints
 */

/**
 * @swagger
 * paths:
 *   /login:
 *     post:
 *       tags: [Login]
 *       summary: Authenticate user
 *       requestBody:
 *         required: true
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 username:
 *                   type: string
 *                   description: Username of the user
 *                 password:
 *                   type: string
 *                   description: Password of the user
 *               required:
 *                 - username
 *                 - password
 *       responses:
 *         '200':
 *           description: Successful authentication
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   token:
 *                     type: string
 *                     description: JWT token for authenticated user
 *                   username:
 *                     type: string
 *                     description: Username of the authenticated user
 *                   id:
 *                     type: string
 *                     description: Unique identifier of the authenticated user
 *         '400':
 *           description: Validation error
 *           content:
 *             application/json:
 *               schema:
 *                 type: object
 *                 properties:
 *                   error:
 *                     type: string
 *                     description: Error message
 *                   message:
 *                     type: string
 *                     description: Details of the validation error
 *         '401':
 *           description: Incorrect username or password
 *           content:
 *             text/plain:
 *               schema:
 *                 type: string
 *                 description: Error message
 */
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
