// Downloads the MongoDB binary once before any worker starts. Without this, parallel workers on a
// fresh machine (CI) all download it at once and collide renaming the finished file.
const { MongoMemoryServer } = require('../backend/node_modules/mongodb-memory-server');

module.exports = async () => {
  const mongo = await MongoMemoryServer.create();
  await mongo.stop();
};
