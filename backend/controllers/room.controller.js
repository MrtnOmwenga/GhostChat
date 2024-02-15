const RoomsRoutes = require('express').Router();
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const csrf = require('csurf');
const Rooms = require('../models/room.model');
const { ValidateRoom,  ValidateJoin, ValidateMongoId, isRoomNameUnique } = require('../services/room-validator.service.js');

const csrfProtection = csrf({ cookie: true });

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

RoomsRoutes.post('/', csrfProtection, async (request, response) => {
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

  try {
    // Check if room name exists
    await isRoomNameUnique(name);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Use parametized query to 
    const result = await Rooms.create({ name, creator: request.token.id, password: hashedPassword });

    // 
    return response.status(201).json(result);
  } catch (error) {
    return response.status(400).json({ error: 'Validation error', message: error.message });
  }
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
  try {
    const room = await Rooms.findById(request.params.id);
    if (!room) {
      return response.status(404).json({ error: 'Not found', message: 'Room not found' });
    }
    return response.json(room);
  } catch (error) {
    return response.status(500).send('Internal Server Error');
  }
});

RoomsRoutes.delete('/:id', csrfProtection, async (request, response) => {
  // Check that user is validated
  if (!request.token) {
    return response.status(400).send('Invalid Token');
  }

  // Validate ID
  const validation = ValidateMongoId(request.params.id);
  if (validation.error) {
    return response.status(400).json({ error: 'Validation error', message: validation.error.message });
  }

  try {
    const requestedRoom = await Rooms.findById(request.params.id);
    if (!requestedRoom) {
      return response.status(404).json({ error: 'Not found', message: 'Room not found' });
    }
    if (request.token.id !== requestedRoom.creator.toString()) {
      return response.status(405).send('Operation not allowed');
    }
    await Rooms.deleteOne({ _id: request.params.id });
    return response.status(204).end();
  } catch (error) {
    return response.status(500).send('Internal Server Error');
  }
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
RoomsRoutes.post('/join', csrfProtection, async (request, response) => {
  const { name, password } = request.body.params;

  // Validate request body
  const validation = ValidateJoin({ name, password });
  if (validation.error) {
    return response.status(400).json({ error: 'Validation error', message: validation.error.message });
  }

  try {
    const room = await Rooms.findOne({ name });
    if (!room) {
      return response.status(400).send('Room not found');
    }

    const correctPassword = await bcrypt.compare(password, room.password);
    if (!correctPassword) {
      return response.status(401).send('Incorrect username or password');
    }

    return response.status(200).json(room);
  } catch (error) {
    return response.status(500).send('Internal Server Error');
  }
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
