const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const UserRoutes = require('./controllers/user.controller');
const LoginRoutes = require('./controllers/login.controller');
const RoomsRoutes = require('./controllers/room.controller');
const middlewares = require('./utils/middlewares.utils');
const log = require('./utils/logger.utils');
const config = require('./utils/config.utils');

// Connect to database
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

// app.use(express.static('build'));

app.use(middlewares.requestLogger);
app.use(middlewares.TokenExtractor);

// Register routes
app.use('/api/users', UserRoutes);
app.use('/api/rooms', RoomsRoutes);
app.use('/services/login', LoginRoutes);

module.exports = app;
