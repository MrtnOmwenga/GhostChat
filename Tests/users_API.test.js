const supertest = require('supertest');
const mongoose = require('mongoose');
const { users } = require('./users.json');
const Users = require('../models/users');
const app = require('../App');

const api = supertest(app);

beforeEach(async () => {
  await Users.deleteMany({});

  const PromiseArray = users
    .map((UserObjects) => new Users(UserObjects))
    .map((UserModel) => UserModel.save());

  await Promise.all(PromiseArray);
}, 1000000);

describe('Check that database is fully initialized', () => {
  test('All Objects have been added to database', async () => {
    const UsersInDB = await Users.find({});

    expect(UsersInDB).toHaveLength(users.length);
  });
});

describe('Test get url', () => {
  test('API returns all objects from db in json format', async () => {
    const response = await api
      .get('/api/users')
      .expect(200)
      .expect('Content-Type', /application\/json/);

    expect(response.body).toHaveLength(users.length);
  });

  test('API returns correct user when valid id is passed', async () => {
    const UsersInDB = await Users.find({});
    const UserToCheck = UsersInDB[0];
    const response = await api
      .get(`/api/users/${UserToCheck._id}`)
      .expect(200);

    expect(response.body.username).toContain(UserToCheck.username);
  });
});

afterAll(async () => {
  await mongoose.connection.close();
});
