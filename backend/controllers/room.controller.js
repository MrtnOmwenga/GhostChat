const RoomsRoutes = require('express').Router();
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const Rooms = require('../models/room.model');
const { ValidateRoom,  ValidateJoin, ValidateMongoId, isRoomNameUnique } = require('../services/room-validator.service.js');


/**
 * @swagger
 * tags:
 *   name: Rooms
 *   description: Room management endpoints
 */

/**
 * @swagger
 * /rooms:
 *   get:
 *     tags: [Rooms]
 *     summary: Retrieve all rooms
 *     description: Retrieve a list of all rooms
 *     responses:
 *       '200':
 *         description: A list of rooms
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Room'
 *   post:
 *     tags: [Rooms]
 *     summary: Create a new room
 *     description: Create a new room with a unique name and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       '201':
 *         description: Room created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Room'
 *       '400':
 *         description: Validation error or room name already exists
 *       '401':
 *         description: Unauthorized request
 */
RoomsRoutes.get('/', async (request, response) => {
  // Check that user is validated
  if (!request.token) {
    return response.status(400).send('Invalid Token');
  }

  // Get and return all rooms
  const rooms = await Rooms.find({});
  return response.json(rooms);
});

RoomsRoutes.post('/', async (request, response) => {
  const { name, password } = request.body.params;

  // Check that user is validated
  if (!request.token) {
    return response.status(400).send('Invalid Token');
  }

  // Validate request body
  const validation = ValidateRoom({ name, password});
  if (validation.error) {
    // Handle validation error
    console.error('Validation error:', validation.error.details);
    return response.status(400).json({ error: 'Validation error', message: validation.error.message });
  }

  // Chack if room name exists
  try {
    await isRoomNameUnique(name)
  } catch (error) {
    return response.status(400).json({ error: 'Validation error', message: error.message });
  }

  // Save new room
  const NewRoom = new Rooms({
    name,
    creator: request.token.id,
    password: await bcrypt.hash(password, 10),
  });
  const result = await NewRoom.save();

  return response.status(201).json(result);
});

/**
 * @swagger
 * /rooms/{id}:
 *   get:
 *     tags: [Rooms]
 *     summary: Retrieve a room by ID
 *     description: Retrieve a room's details by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the room to retrieve
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Room found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Room'
 *       '400':
 *         description: Invalid ID format
 *       '401':
 *         description: Unauthorized request
 *       '404':
 *         description: Room not found
 *   delete:
 *     tags: [Rooms]
 *     summary: Delete a room by ID
 *     description: Delete a room by its ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the room to delete
 *         schema:
 *           type: string
 *     responses:
 *       '204':
 *         description: Room deleted successfully
 *       '400':
 *         description: Invalid ID format
 *       '401':
 *         description: Unauthorized request
 *       '405':
 *         description: Operation not allowed
 */
RoomsRoutes.get('/:id', async (request, response) => {
  // Check that user is validated
  if (!request.token) {
    return response.status(400).send('Invalid Token');
  }

  // Validate ID
  const validation = ValidateMongoId(request.params.id);
  if (validation.error) {
    // Handle validation error
    console.error('Validation error:', validation.error.details);
    return response.status(400).json({ error: 'Validation error', message: validation.message });
  }

  // Find room and return it
  const rooms = await Rooms.findById(request.params.id );
  return response.json(rooms);
});

RoomsRoutes.delete('/:id', async (request, response) => {
  // Check that user is validated
  if (!request.token) {
    return response.status(400).send('Invalid Token');
  }

  // Validate ID
  const validation = ValidateMongoId(request.params.id);
  if (validation.error) {
    // Handle validation error
    console.error('Validation error:', validation.error.details);
    return response.status(400).json({ error: 'Validation error', message: validation.error.message });
  }

  const RequestedRoom = await Rooms.findById(request.params.id);
  if (!(request.token.id === RequestedRoom.creator.toString())) {
    return response.status(405).send('Operation not allowed');
  }

  await Rooms.deleteOne({ _id: new ObjectId(request.params.id) });
  return response.status(204).end();
});

/**
 * @swagger
 * /rooms/search:
 *   get:
 *     tags: [Rooms]
 *     summary: Search for rooms
 *     description: Retrieve a list of rooms based on name search
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         description: Name of the room to search for
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: A list of rooms matching the search criteria
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Room'
 *       '401':
 *         description: Unauthorized request
 */
RoomsRoutes.get('/search', async (request, response) => {
  // Check that user is validated
  if (!request.token) {
    return response.status(400).send('Invalid Token');
  }

  const { name } = request.query;
  const rooms = await Rooms.find({ name: { $regex: `^${name}` } });
  return response.json(rooms);
});

/**
 * @swagger
 * /rooms/join:
 *   post:
 *     tags: [Rooms]
 *     summary: Join a room
 *     description: Join a room by providing the room name and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Joined room successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Room'
 *       '400':
 *         description: Validation error or room not found
 *       '401':
 *         description: Incorrect username or password
 */
RoomsRoutes.post('/join', async (request, response) => {
  const { name, password } = request.body.params;

  // Validate request body
  const validation = ValidateJoin({ name, password});
  if (validation.error) {
    // Handle validation error
    console.error('Validation error:', validation.error.details);
    return response.status(400).json({ error: 'Validation error', message: validation.error.message });
  }

  const room = await Rooms.findOne({ name });
  if (room === null) {
    return response.status(400).send('Room not found');
  }

  const CorrectPassword = room === null ? false : await bcrypt.compare(password, room.password);
  if (!CorrectPassword) {
    return response.status(401).send('Incorrect username or password');
  }

  return response
    .status(200)
    .json(room);
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Room:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier for the room
 *         name:
 *           type: string
 *           description: Name of the room
 *         creator:
 *           type: string
 *           description: ID of the user who created the room
 *         password:
 *           type: string
 *           description: Password for accessing the room
 *       required:
 *         - name
 *         - creator
 *         - password
 */

module.exports = RoomsRoutes;
