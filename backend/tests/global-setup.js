// Downloads the MongoDB binary once before any worker starts. Without this, parallel Jest workers on a
// fresh machine (CI) all download it at once and collide renaming the finished file.
const { MongoMemoryServer } = require('mongodb-memory-server');

module.exports = async () => {
  const mongo = await MongoMemoryServer.create();
  await mongo.stop();
};
