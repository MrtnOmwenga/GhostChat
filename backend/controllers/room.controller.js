const RoomsRoutes = require('express').Router();
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const Rooms = require('../models/room.model');
const { ValidateRoom,  ValidateJoin, ValidateMongoId, isRoomNameUnique } = require('../services/room-validator.service.js');

RoomsRoutes.get('/', async (request, response) => {
  // Check that user is validated
  if (!request.token) {
    return response.status(400).send('Invalid Token');
  }

  // Get and return all rooms
  const rooms = await Rooms.find({});
  return response.json(rooms);
});

RoomsRoutes.get('/search', async (request, response) => {
  // Check that user is validated
  if (!request.token) {
    return response.status(400).send('Invalid Token');
  }

  const { name } = request.query;
  const rooms = await Rooms.find({ name: { $regex: `^${name}` } });
  return response.json(rooms);
});

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

module.exports = RoomsRoutes;
