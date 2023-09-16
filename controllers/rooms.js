const RoomsRoutes = require('express').Router();
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const Rooms = require('../models/rooms');

RoomsRoutes.get('/', async (request, response) => {
  const auth = request.token;

  if (!auth) {
    return response.status(400).send('Invalid Token');
  }

  const rooms = await Rooms.find({});
  return response.json(rooms);
});

RoomsRoutes.get('/search', async (request, response) => {
  const auth = request.token;

  if (!auth) {
    return response.status(400).send('Invalid Token');
  }

  const { name } = request.query;
  const rooms = await Rooms.find({ name: { $regex: `^${name}` } });
  return response.json(rooms);
});

RoomsRoutes.get('/:id', async (request, response) => {
  const auth = request.token;

  if (!auth) {
    return response.status(400).send('Invalid Token');
  }

  const rooms = await Rooms.find({ creator: request.params.id });
  return response.json(rooms);
});

RoomsRoutes.post('/', async (request, response) => {
  const { name, password } = request.body.params;

  const auth = request.token;

  const room = await Rooms.find({ name });
  if (room) {
    return response.status(500).send('Room already exists');
  }

  if (!auth) {
    return response.status(400).send('Invalid Token');
  }

  if (!name || !password) {
    return response.status(400).send('Please fill all fields.');
  }

  if (password.length < 6) {
    return response.status(400).send('The password must be at least 6 characters long.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const NewRoom = new Rooms({
    name,
    creator: auth.id,
    password: passwordHash,
  });

  const result = await NewRoom.save();

  return response.status(201).json({ ...result });
});

RoomsRoutes.post('/join', async (request, response) => {
  const { name, password } = request.body.params;

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
  const auth = request.token;
  if (!auth) {
    return response.status(400).send('Invalid Token');
  }

  const RequestedRoom = await Rooms.findById(request.params.id);

  if (!(auth.id === RequestedRoom.creator.toString())) {
    return response.status(405).send('Operation not allowed');
  }

  await Rooms.deleteOne({ _id: new ObjectId(request.params.id) });
  return response.status(204).end();
});

module.exports = RoomsRoutes;
