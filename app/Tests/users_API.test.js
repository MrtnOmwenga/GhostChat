const supertest = require('supertest');
const mongoose = require('mongoose');
const { users } = require('./users.json');
const Users = require('../models/users');
const app = require('../App');

const api = supertest(app);

/* The `beforeEach` function is a hook provided by the testing framework (Jest) that is executed before
each test case in the test suite. In this case, it is used to set up the initial state of the
database before running the tests. */
beforeEach(async () => {
  await Users.deleteMany({});

  const PromiseArray = users
    .map((UserObjects) => new Users(UserObjects))
    .map((UserModel) => UserModel.save());

  await Promise.all(PromiseArray);
}, 1000000);

/* The code block `describe('Check that database is fully initialized', () => { ... })` is a test suite
that contains one test case. */
describe('Check that database is fully initialized', () => {
  test('All Objects have been added to database', async () => {
    const UsersInDB = await Users.find({});

    expect(UsersInDB).toHaveLength(users.length);
  });
});

/* The code block `describe('Test get url', () => { ... })` is a test suite that contains two test
cases. */
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

/* The `afterAll` function is a hook provided by the testing framework (Jest) that is executed after
all the test cases in the test suite have been run. In this case, it is used to close the connection
to the MongoDB database after all the tests have finished running. This ensures that the database
connection is properly closed and resources are freed up. */
afterAll(async () => {
  await mongoose.connection.close();
});
