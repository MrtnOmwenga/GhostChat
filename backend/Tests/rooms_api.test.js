const supertest = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { rooms } = require('./rooms.json');
const Rooms = require('../models/room.model.js');
const app = require('../App.js');

const api = supertest(app);

let token; // To store the token globally
let auth;
const validRoomData = {
  name: 'TestRoom',
  password: 'testpassword',
};

beforeAll(async () => {
  // Make a request to /services/login to get the token
  const loginResponse = await api
    .post('/services/login')
    .send({
      username: 'Kevin Cozner',
      password: 'foobar',
    });

  // Extract the token from the response
  token = loginResponse.body.token;
  auth = loginResponse.body.id;

  await Rooms.deleteMany({});

  const PromiseArray = rooms
    .map((RoomObjects) => new Rooms(RoomObjects))
    .map((RoomModel) => RoomModel.save());

  await Promise.all(PromiseArray);
}, 1000000);

describe('Check that database is fully initialized', () => {
  test('All Objects have been added to database', async () => {
    const RoomsInDB = await Rooms.find({});

    expect(RoomsInDB).toHaveLength(rooms.length);
  });
});

describe('Test get url', () => {
  test('API returns all objects from db in json format', async () => {
    const response = await api
      .get('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect('Content-Type', /application\/json/);

    expect(response.body).toHaveLength(rooms.length);
  });

  test('API returns correct room when valid id is passed', async () => {
    const room = new Rooms({
      name: 'Test Room 1',
      creator: auth,
      password: await bcrypt.hash(validRoomData.password, 10),
    });
    await room.save();

    const response = await api
      .get(`/api/rooms/${room._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.name).toContain(room.name);
  });

  it('should return 400 for invalid token', async () => {
    const room = new Rooms({
      name: 'Test Room 2',
      creator: auth,
      password: await bcrypt.hash(validRoomData.password, 10),
    });
    await room.save();

    const response = await api
      .get(`/api/rooms/${room._id}`)

    expect(response.status).toBe(400);
    expect(response.text).toBe('Invalid Token');
  });
});

describe('POST /api/rooms', () => {
  it('should create a new room and return 201', async () => {
    const response = await api
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ params: validRoomData });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe(validRoomData.name);
    expect(response.body.creator).toEqual(auth);
  });

  it('should return 400 for already existing room', async () => {
    const response = await api
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ params: validRoomData });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Validation error', message: 'Room name must be unique.' });
  });

  it('should return 400 for invalid token', async () => {
    const response = await api.post('/api/rooms').send({ params: validRoomData });

    expect(response.status).toBe(400);
    expect(response.text).toBe('Invalid Token');
  });

  it('should return 400 for validation error', async () => {
    const response = await api
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ params: { name: validRoomData.name } });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Validation error', message: 'Password is required.' });
  });
});

describe('POST /api/rooms/join', () => {
  it('should join a room and return 200', async () => {
    const room = new Rooms({
      name: 'ExistingRoom',
      creator: auth,
      password: await bcrypt.hash(validRoomData.password, 10),
    });
    await room.save();

    const response = await api
      .post('/api/rooms/join')
      .send({ params: { name: 'ExistingRoom', password: validRoomData.password } });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe(room.name);
    expect(response.body.creator).toEqual(room.creator.toString());
  });

  it('should return 400 for validation error', async () => {

    const response = await api
      .post('/api/rooms/join')
      .send({ params: { name: validRoomData.name } });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Validation error', message: 'Password is required.' });
  });

  it('should return 400 for room not found', async () => {
    const response = await api
      .post('/api/rooms/join')
      .send({ params: { name: 'NonExistentRoom', password: 'foobar' } });

    expect(response.status).toBe(400);
    expect(response.text).toBe('Room not found');
  });

  it('should return 401 for incorrect password', async () => {
    const RoomsInDB = await Rooms.find({});
    const RoomToJoin = RoomsInDB[0];

    const response = await api
      .post('/api/rooms/join')
      .send({ params: { name: RoomToJoin.name, password: 'incorrect-password' } });

    expect(response.status).toBe(401);
    expect(response.text).toBe('Incorrect username or password');
  });
});

describe('DELETE /api/rooms/:id', () => {
  it('should delete a room and return 204', async () => {
    const room = new Rooms({
      name: 'RoomToDelete',
      creator: auth,
      password: await bcrypt.hash(validRoomData.password, 10),
    });
    await room.save();

    const response = await api
      .delete(`/api/rooms/${room._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(204);
    expect(await Rooms.findById(room._id)).toBeNull();
  });

  it('should return 400 for invalid token', async () => {
    const response = await api.delete(`/api/rooms/${auth}`);

    expect(response.status).toBe(400);
    expect(response.text).toBe('Invalid Token');
  });

  it('should return 400 for validation error', async () => {
    const response = await api
      .delete('/api/rooms/invalid-id')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ 'error': 'Validation error', message: '"value" failed custom validation because Invalid MongoDB ID.'});
  });

  it('should return 405 for unauthorized user', async () => {
    const room = new Rooms({
      name: 'UnauthorizedRoom',
      creator: new mongoose.Types.ObjectId(),
      password: await bcrypt.hash(validRoomData.password, 10),
    });
    await room.save();

    const response = await api
      .delete(`/api/rooms/${room._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(405);
    expect(response.text).toBe('Operation not allowed');
  });
});


describe('Test resistance to SQL injection attacks', () => {
  it('should return 400 for room name with SQL injection', async () => {
    // Malicious input with SQL injection
    const maliciousInput = { name: { $ne: null }, password: 'testpassword' };

    const response = await api
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ params: maliciousInput });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Validation error', message: '"name" must be a string' });
  });

  it('should return 400 for room name with SQL injection in join', async () => {
    // Malicious input with SQL injection
    const maliciousInput = { name: { $regex: '.*' }, password: 'testpassword' };

    const response = await api
      .post('/api/rooms/join')
      .send({ params: maliciousInput });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Validation error', message: '"name" must be a string' });
  });
});


afterAll(async () => {
  await mongoose.connection.close();
});
