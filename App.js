const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const UserRoutes = require('./controllers/users');
const LoginRoutes = require('./controllers/login');
const log = require('./utils/logger');
const config = require('./utils/config');

mongoose.set('strictQuery', false);

log.info(`connecting to ${config.MONGODB_URI}`);
mongoose.connect(config.MONGODB_URI)
  .then(() => {
    log.info('connected to mongodb');
  }).catch((error) => {
    log.error('error connecting to MongoDB:', error.message);
  });

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/users', UserRoutes);
app.use('/services/login', LoginRoutes);

module.exports = app;
