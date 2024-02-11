const supertest = require('supertest');
const mongoose = require('mongoose');
const { users } = require('./users.json');
const Users = require('../models/user.model.js');
const app = require('../App.js');

const api = supertest(app);

let token; // To store the token globally

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
}, 100000);

beforeEach(async () => {
  await Users.deleteMany({});

  const PromiseArray = users
    .map((UserObjects) => new Users(UserObjects))
    .map((UserModel) => UserModel.save());

  await Promise.all(PromiseArray);
}, 1000000);

describe('Check that database is fully initialized', () => {
  test('All Objects have been added to the database', async () => {
    const UsersInDB = await Users.find({});
    expect(UsersInDB).toHaveLength(users.length);
  });
});

describe('GET /api/users', () => {
  test('API returns all users from the database in JSON format', async () => {
    const response = await api
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect('Content-Type', /application\/json/);

    expect(response.body).toHaveLength(users.length);
  });

  test('API returns 401 when no token is provided', async () => {
    const response = await api
      .get('/api/users')
      .expect(401)
      .expect('Content-Type', /application\/json/);

    expect(response.body.error).toBe('Unauthorized');
  });
});

describe('GET /api/users/search', () => {
  test('API returns filtered users based on search criteria', async () => {
    const response = await api
      .get('/api/users/search')
      .query({ username: 'K', user: 'John Doe' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect('Content-Type', /application\/json/);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].username).toBe('Kevin Cozner');
  });

  test('API returns 401 when no token is provided', async () => {
    const response = await api
      .get('/api/users/search')
      .query({ username: 'K', user: 'John Doe' })
      .expect(401)
      .expect('Content-Type', /application\/json/);

    expect(response.body.error).toBe('Unauthorized');
  });
});

describe('GET /api/users/:id', () => {
  test('API returns the correct user when a valid ID is passed', async () => {
    const UsersInDB = await Users.find({});
    const UserToCheck = UsersInDB[0];
    const response = await api
      .get(`/api/users/${UserToCheck._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.username).toContain(UserToCheck.username);
  });

  test('API returns 400 for an invalid ID', async () => {
    const response = await api
      .get('/api/users/invalidId')
      .set('Authorization', `Bearer ${token}`)
      .expect(400)

    expect(response.body).toEqual({ 'error': 'Validation error', 'message': '"value" failed custom validation because Invalid MongoDB ID.' });
  });

  test('API returns 404 for a non-existing ID', async () => {
    const nonExistingId = new mongoose.Types.ObjectId();
    const response = await api
      .get(`/api/users/${nonExistingId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404)
      .expect('Content-Type', /application\/json/);

    expect(response.body).toEqual({ 'error': 'Validation error', 'message': 'User not found.' });
  });
});

describe('POST /api/users', () => {
  test('API creates a new user with valid data', async () => {
    const newUser = {
      username: 'NewUser',
      password: 'newpassword',
    };

    const response = await api
      .post('/api/users')
      .send(newUser)
      .expect(201)
      .expect('Content-Type', /application\/json/);

    expect(response.body).toHaveProperty('token');
    expect(response.body.username).toBe(newUser.username);
  });

  test('API returns 400 for validation error', async () => {
    const invalidUser = {
      username: 'U', // Invalid username (less than 3 characters)
      password: 'newpassword',
    };

    const response = await api
      .post('/api/users')
      .send(invalidUser)
      .expect(400)

    expect(response.body).toEqual({ 'error': 'Validation error', 'message': 'Username must have at least 3 characters.' });
  });

  test('API returns 400 for duplicate username', async () => {
    const duplicateUser = {
      username: 'Kevin Cozner', // Existing username
      password: 'newpassword',
    };

    const response = await api
      .post('/api/users')
      .send(duplicateUser)
      .expect(400)
      .expect('Content-Type', /application\/json/);

    expect(response.body).toEqual({ 'error': 'Validation error', 'message': 'Username must be unique.' });
  });
});

describe('PUT /api/users/:id', () => {
  test('API updates an existing user with valid data', async () => {
    const UsersInDB = await Users.find({});
    const userToUpdate = UsersInDB[0];

    const updatedUserData = {
      username: 'UpdatedUser',
      password: 'updatedpassword',
    };

    const response = await api
      .put(`/api/users/${userToUpdate._id}`)
      .send(updatedUserData)
      .set('Authorization', `Bearer ${token}`)
      // .expect(200)
      // .expect('Content-Type', /application\/json/);

    expect(response.body.username).toBe(updatedUserData.username);
  });

  test('API returns 400 for validation error', async () => {
    const UsersInDB = await Users.find({});
    const userToUpdate = UsersInDB[0];

    const invalidUserData = {
      username: 'U', // Invalid username (less than 3 characters)
      password: 'updatedpassword',
    };

    const response = await api
      .put(`/api/users/${userToUpdate._id}`)
      .send(invalidUserData)
      .set('Authorization', `Bearer ${token}`)
      .expect(400)
      .expect('Content-Type', /application\/json/);

    expect(response.body.error).toBe('Validation error');
  });

  test('API returns 401 when no token is provided', async () => {
    const UsersInDB = await Users.find({});
    const userToUpdate = UsersInDB[0];

    const updatedUserData = {
      username: 'UpdatedUser',
      password: 'updatedpassword',
    };

    const response = await api
      .put(`/api/users/${userToUpdate._id}`)
      .send(updatedUserData)
      .expect(401)
      .expect('Content-Type', /application\/json/);

    expect(response.body.error).toBe('Unauthorized');
  });
});

describe('DELETE /api/users/:id', () => {
  test('API deletes an existing user', async () => {
    const UsersInDB = await Users.find({});
    const userToDelete = UsersInDB[0];

    await api
      .delete(`/api/users/${userToDelete._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    const userInDBAfterDelete = await Users.findById(userToDelete._id);
    expect(userInDBAfterDelete).toBeNull();
  });

  test('API returns 401 when no token is provided', async () => {
    const UsersInDB = await Users.find({});
    const userToDelete = UsersInDB[0];

    const response = await api
      .delete(`/api/users/${userToDelete._id}`)
      .expect(401)
      .expect('Content-Type', /application\/json/);

    expect(response.body.error).toBe('Unauthorized');
  });

  test('API returns 400 for invalid user ID', async () => {
    const response = await api
      .delete('/api/users/invalidId')
      .set('Authorization', `Bearer ${token}`)
      .expect(400)
      .expect('Content-Type', /application\/json/);

    expect(response.body.error).toBe('Validation error');
  });

  test('API returns 404 for non-existing user ID', async () => {
    const nonExistingId = new mongoose.Types.ObjectId();
    const response = await api
      .delete(`/api/users/${nonExistingId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404)
      .expect('Content-Type', /application\/json/);

    expect(response.body).toEqual({ 'error': 'Validation error', 'message': 'User not found.' });
  });
});

afterAll(async () => {
  await mongoose.connection.close();
});
